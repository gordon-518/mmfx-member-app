-- Bounce suppression for the lifecycle rail (2026-09-23).
--
-- Day one sent 2,366 emails and 107 addresses hard-bounced ("Bad recipients",
-- gmail.como, gmail.con …). Nothing suppressed them, so the next digest would
-- have hit every one again, every day, and SendPulse cuts the hourly limit at
-- a 7% bounce rate. This marks an address the first time it bounces and keeps
-- it out of every claim from then on. Undoing it is a NULL on the column.
--
-- Everything is in the database on purpose: the webhook receiver and the cron
-- route keep writing what they write, and two triggers do the rest.

alter table public.email_prefs
  add column if not exists bounced_at timestamptz;

comment on column public.email_prefs.bounced_at is
  'Set when a send to this user hard-bounced (email_events hard_bounce/undelivered) or SendPulse refused the recipient at send time. The claim function skips the user while it is set. Clear it by hand to re-enable.';

-- Backfill from what has already happened.
update public.email_prefs pr
   set bounced_at = x.first_bounce
  from (
    select s.user_id, min(coalesce(e.occurred_at, e.received_at)) as first_bounce
      from public.email_events e
      join public.email_sends s on s.id = e.send_id
     where e.event in ('hard_bounce', 'undelivered')
     group by s.user_id
  ) x
 where x.user_id = pr.user_id and pr.bounced_at is null;

update public.email_prefs pr
   set bounced_at = x.first_fail
  from (
    select s.user_id, min(s.sent_at) as first_fail
      from public.email_sends s
     where s.ok = false and s.error ilike '%Recipient email is invalid%'
     group by s.user_id
  ) x
 where x.user_id = pr.user_id and pr.bounced_at is null;

-- Trigger 1: a hard bounce or permanent non-delivery on any send marks the user.
create or replace function public.fn_email_event_mark_bounce()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.send_id is not null and new.event in ('hard_bounce', 'undelivered') then
    update public.email_prefs pr
       set bounced_at = coalesce(new.occurred_at, now())
      from public.email_sends s
     where s.id = new.send_id
       and pr.user_id = s.user_id
       and pr.bounced_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_email_event_mark_bounce on public.email_events;
create trigger trg_email_event_mark_bounce
  after insert on public.email_events
  for each row execute function public.fn_email_event_mark_bounce();

-- Trigger 2: SendPulse refusing the recipient at send time is the same fact.
create or replace function public.fn_email_send_mark_invalid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ok = false and new.error ilike '%Recipient email is invalid%' then
    update public.email_prefs
       set bounced_at = coalesce(bounced_at, new.sent_at, now())
     where user_id = new.user_id
       and bounced_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_email_send_mark_invalid on public.email_sends;
create trigger trg_email_send_mark_invalid
  after update of ok on public.email_sends
  for each row execute function public.fn_email_send_mark_invalid();

revoke all on function public.fn_email_event_mark_bounce() from public, anon, authenticated;
revoke all on function public.fn_email_send_mark_invalid() from public, anon, authenticated;

-- The claim function, re-created verbatim from 20260922000001 with one more
-- guard (bounced_at is null). RETURNS TABLE cannot be widened in place, hence
-- drop + create, as before.
drop function if exists public.fn_claim_email_sends(integer, integer[], integer);

create or replace function public.fn_claim_email_sends(
  p_limit         integer   default 200,
  -- ISO day-of-week (Mon = 1). DIGEST_DAYS: every trading day (Gordon,
  -- 2026-09-22). The desk publishes Mon-Fri, so weekends carry no digest.
  p_digest_days   integer[] default array[1, 2, 3, 4, 5],
  -- Spotlight day, default Saturday: the one day with no read to displace
  -- (spotlight outranks digest on a clash), and weekend reading time for a
  -- guide. SPOTLIGHT_DAY overrides.
  p_spotlight_day integer   default 6
)
returns table (
  send_id                   uuid,
  user_id                   uuid,
  email                     text,
  first_name                text,
  flow                      text,
  step                      text,
  dedupe_key                text,
  audience                  text,
  account_status            text,
  trial_ends_at             timestamptz,
  deposit_amount            numeric,
  grandfathered             boolean,
  lifetime_plan             text,
  days_since_signup         integer,
  onb_tv                    boolean,
  onb_analysis              boolean,
  onb_kys                   boolean,
  onb_lesson1               boolean,
  onb_desk                  boolean,
  analysis_title            text,
  analysis_bias             text,
  analysis_description      text,
  unsub_token               text,
  upgrade_viewed_at         timestamptz,
  upgrade_broker_clicked_at timestamptz,
  spotlight_id              uuid,
  -- added 2026-09-22 (§4)
  variant                   text,
  cover_path                text
)
language plpgsql
security definer
set search_path = ''
as $$
  -- RETURNS TABLE declares user_id, flow, step … as OUT variables, and inside
  -- the body a bare column name in ON CONFLICT (user_id) is then ambiguous
  -- (42702 on Postgres 17, caught in the 2026-09-22 rollback dry run).
  -- Every table reference here is qualified; the OUT names are only ever
  -- assigned through RETURN QUERY, so resolving clashes to the column is safe.
  #variable_conflict use_column
declare
  v_limit     integer := greatest(1, least(coalesce(p_limit, 200), 1000));
  -- The desk runs on Singapore time, and so does "today's" analysis.
  v_today     date    := (now() at time zone 'Asia/Singapore')::date;
  v_dow       integer := extract(isodow from (now() at time zone 'Asia/Singapore'))::integer;
  -- Midnight SGT today, as an instant. The one-email-per-day cap (§1.5) is a
  -- CALENDAR day, not a rolling 24h: a rolling window ratchets every send later
  -- than the last one (eligible at 14:20 → claimed 14:25 → eligible 14:25 …),
  -- so a daily digest would drift towards midnight and start missing days.
  v_day_start timestamptz := (v_today::timestamp) at time zone 'Asia/Singapore';
  v_spotlight uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(4821001);

  -- Unwind stranded claims. A row stays ok = null only between the claim and
  -- the route stamping the result; the route's own ceiling is maxDuration 300,
  -- so anything still null after an hour belongs to a run that was killed
  -- mid-batch. Left alone it would hold that step's dedupe_key and that user's
  -- daily slot forever, for an email nobody received.
  delete from public.email_sends
   where ok is null
     and sent_at < now() - interval '1 hour';

  select s.id into v_spotlight
    from public.email_spotlights s
   order by s.approved_at desc
   limit 1;

  -- Everyone needs an unsub token before they can be emailed. Cheap after the
  -- first run: the anti-join finds nothing.
  insert into public.email_prefs (user_id)
  select p.id
    from public.profiles p
   where not exists (select 1 from public.email_prefs e where e.user_id = p.id)
  on conflict (user_id) do nothing;

  return query
  with da as (
    -- The newest PUBLISHED read, same as the dashboard and the organic feed:
    -- an unpublished draft must never enable a digest, let alone be sent.
    --
    -- published_on defaults to current_date in UTC while the desk works in
    -- SGT, so between 00:00 and 08:00 SGT today's read is still stamped
    -- yesterday. Matching on = v_today dropped Monday's digest entirely.
    -- Hence <= v_today, bounded to the last day so a gap in publishing can
    -- never present a stale read as today's.
    --
    -- And it must have been WRITTEN today (SGT). The desk publishes between
    -- 12:00 and 19:00 SGT (82 reads sampled 2026-09-22: none before 07:00),
    -- while this runs around the clock. Without this bound the 00:05 run
    -- would send yesterday's read under today's dedupe key, and today's real
    -- read would then never go out. created_at is the upload instant; the
    -- only rows where it disagrees with published_on are June's backfills,
    -- which the published_on window already excludes.
    --
    -- cover_path added 2026-09-22: the digest's analysis card shows the cover,
    -- which is public in the analysis-covers bucket. It is nullable — an older
    -- read without one renders the card without an image.
    select d.title, d.bias, d.description, d.cover_path
      from public.daily_analysis d
     where d.is_published
       and d.published_on <= v_today
       and d.published_on >= v_today - 1
       and d.created_at >= v_day_start
     order by d.published_on desc, d.created_at desc
     limit 1
  ),
  ev as (
    select e.user_id,
           bool_or(e.event = 'feature_view' and e.props ->> 'feature' = 'daily-analysis') as analysis,
           bool_or(e.event = 'onboarding_step_done' and e.props ->> 'step' = 'lesson-1')  as lesson1,
           bool_or(e.event = 'upgrade_viewed')                                            as desk,
           max(e.created_at) filter (where e.event = 'upgrade_viewed')               as upgrade_viewed_at,
           max(e.created_at) filter (where e.event = 'upgrade_broker_link_clicked')  as broker_clicked_at
      from public.app_events e
     where e.event in ('feature_view', 'onboarding_step_done', 'upgrade_viewed', 'upgrade_broker_link_clicked')
     group by e.user_id
  ),
  base as (
    select p.id                                          as user_id,
           p.email                                       as email,
           p.full_name                                   as full_name,
           p.account_status                              as account_status,
           p.trial_ends_at                               as trial_ends_at,
           p.deposit_amount                              as deposit_amount,
           p.grandfathered                               as grandfathered,
           p.lifetime_plan                               as lifetime_plan,
           p.deposit_verified_at                         as deposit_verified_at,
           p.last_activity_at                            as last_activity_at,
           pr.unsub_token                                as unsub_token,
           -- mirrors audienceFor()
           case
             when p.account_status = 'member_active'  then 'member'
             when p.account_status = 'member_expired' then 'removed'
             when p.account_status in ('trial_active', 're_trial_active')
                  and p.trial_ends_at > now()         then 'trial'
             else 'expired'
           end                                           as audience,
           -- mirrors TIER_RANK[tierFor()] for members: foundation 1, desk 2, team 3
           case
             when p.account_status <> 'member_active'                        then 0
             when p.grandfathered or p.lifetime_plan is not null              then 3
             when coalesce(p.deposit_amount, 0) >= 500                        then 3
             when coalesce(p.deposit_amount, 0) >= 200                        then 2
             else 1
           end                                           as tier_rank,
           -- WHOLE days elapsed. floor, not a rounding cast: day 11.6 must not
           -- count as day 12 and fire the day-12 email ten hours early.
           greatest(0, floor(extract(epoch from (now() - p.signup_at)) / 86400)::integer) as days_since_signup,
           (p.tradingview_username is not null)          as onb_tv,
           coalesce(ev.analysis, false)                  as onb_analysis,
           (p.kys_completed_at is not null)              as onb_kys,
           coalesce(ev.lesson1, false)                   as onb_lesson1,
           coalesce(ev.desk, false)                      as onb_desk,
           ev.upgrade_viewed_at                          as upgrade_viewed_at,
           ev.broker_clicked_at                          as broker_clicked_at,
           -- "Never submitted a deposit", the same predicate fn_admin_hot_leads
           -- uses. deposit-dm-reminder owns everyone on the other side of it:
           -- telling someone who already filed a submission that they look
           -- stuck at the broker step is the one duplication §3C forbids.
           exists (select 1 from public.deposit_submissions sub
                    where sub.user_id = p.id)         as has_submission
      from public.profiles p
      join public.email_prefs pr on pr.user_id = p.id
      left join ev on ev.user_id = p.id
     where p.email is not null
       and p.email <> ''
       -- guard 1: opted out of marketing
       and pr.marketing_opted_out = false
       -- guard 1b: the address has hard-bounced (or SendPulse refused it at
       -- send time). Set by the triggers in 20260923000001; cleared by hand.
       and pr.bounced_at is null
       -- guard 2: one email per user per SGT calendar day, across EVERY lane (§1.5)
       and not exists (
             select 1 from public.email_sends s
              where s.user_id = p.id and s.sent_at >= v_day_start)
       and not exists (
             select 1 from public.journal_interventions ji
              where ji.user_id = p.id and ji.sent_at >= v_day_start)
       -- The third lane: deposit-dm-reminder emails from its own table, so a
       -- member nudged about their submission must not also get a lifecycle
       -- email the same day.
       and not exists (
             select 1 from public.deposit_submissions ds
              where ds.user_id = p.id
                and ds.dm_reminder_sent_at >= v_day_start)
       -- Admins are staff, not an audience (as fn_admin_hot_leads has it).
       and not coalesce(p.is_admin, false)
  ),
  cand as (
    -- C. Hot-lead rescue — behavioural, any non-member stage, no deposit yet.
    -- Never overlaps deposit-dm-reminder: that flow owns deposit_submitted,
    -- this one only fires for people who never submitted anything.
    select b.*,
           'rescue'::text         as flow,
           'broker-clicked'::text as step,
           10                     as priority,
           b.user_id::text || ':rescue:broker-clicked' as dedupe_key
      from base b
     where b.audience in ('trial', 'expired')
       and b.deposit_verified_at is null
       and not b.has_submission
       and b.broker_clicked_at is not null
       and b.broker_clicked_at <= now() - interval '24 hours'
    union all
    select b.*, 'rescue'::text, 'upgrade-seen'::text, 11,
           b.user_id::text || ':rescue:upgrade-seen'
      from base b
     where b.audience in ('trial', 'expired')
       and b.deposit_verified_at is null
       and not b.has_submission
       and b.upgrade_viewed_at is not null
       and b.upgrade_viewed_at <= now() - interval '48 hours'

    -- A. Trial activation (§3A). Conditional steps pre-empt scheduled ones.
    union all
    select b.*, 'trial'::text, 'welcome'::text, 20,
           b.user_id::text || ':trial:welcome'
      from base b where b.audience = 'trial'
    union all
    select b.*, 'trial'::text, 'analysis'::text, 30,
           b.user_id::text || ':trial:analysis'
      from base b where b.audience = 'trial' and b.days_since_signup >= 1 and not b.onb_analysis
    union all
    select b.*, 'trial'::text, 'kys'::text, 31,
           b.user_id::text || ':trial:kys'
      from base b where b.audience = 'trial' and b.days_since_signup >= 2 and not b.onb_kys
    union all
    select b.*, 'trial'::text, 'tv'::text, 32,
           b.user_id::text || ':trial:tv'
      from base b where b.audience = 'trial' and b.days_since_signup >= 4 and not b.onb_tv
    union all
    select b.*, 'trial'::text, 'lesson1'::text, 33,
           b.user_id::text || ':trial:lesson1'
      from base b where b.audience = 'trial' and b.days_since_signup >= 6 and not b.onb_lesson1
    -- day12 outranks ladder so the more timely one wins when both are due;
    -- the other follows the next day, the daily cap permitting.
    union all
    select b.*, 'trial'::text, 'day12'::text, 40,
           b.user_id::text || ':trial:day12'
      from base b where b.audience = 'trial' and b.days_since_signup >= 12
    union all
    select b.*, 'trial'::text, 'ladder'::text, 41,
           b.user_id::text || ':trial:ladder'
      from base b where b.audience = 'trial' and b.days_since_signup >= 9

    -- D. Member activation (§3D).
    union all
    select b.*, 'member'::text, 'member-d3'::text, 50,
           b.user_id::text || ':member:member-d3'
      from base b
     where b.audience = 'member'
       and b.tier_rank >= 3
       and b.deposit_verified_at is not null
       and b.deposit_verified_at <= now() - interval '3 days'
       -- 'deployed' is the only state that means the assistant is actually
       -- running (journal_core: connecting / deployed / failed / disconnected).
       -- Treating 'failed' as connected would silence this email for exactly
       -- the people whose connection needs help.
       and not exists (
             select 1 from public.journal_accounts ja
              where ja.user_id = b.user_id and ja.state = 'deployed')
    union all
    select b.*, 'member'::text, 'member-d7'::text, 51,
           b.user_id::text || ':member:member-d7'
      from base b
     where b.audience = 'member'
       and b.tier_rank >= 2
       and b.deposit_verified_at is not null
       and b.deposit_verified_at <= now() - interval '7 days'
    -- One dormancy email, then 60 days of silence (§3D).
    union all
    select b.*, 'member'::text, 'member-dormant'::text, 52,
           b.user_id::text || ':member:member-dormant:' || v_today::text
      from base b
     where b.audience = 'member'
       and b.last_activity_at is not null
       and b.last_activity_at < now() - interval '30 days'
       and not exists (
             select 1 from public.email_sends s
              where s.user_id = b.user_id
                and s.step = 'member-dormant'
                and s.sent_at > now() - interval '60 days')

    -- B. Free-tier nurture (§3B). Spotlight outranks digest on a clash.
    union all
    select b.*, 'nurture'::text, 'spotlight'::text, 60,
           b.user_id::text || ':nurture:spotlight:' || v_spotlight::text
      from base b
     where b.audience = 'expired'
       and v_spotlight is not null
       and v_dow = p_spotlight_day
    union all
    select b.*, 'nurture'::text, 'digest'::text, 61,
           b.user_id::text || ':nurture:digest:' || v_today::text
      from base b
     where b.audience = 'expired'
       and v_dow = any(p_digest_days)
       and exists (select 1 from da)
  ),
  due as (
    select distinct on (c.user_id) c.*
      from cand c
     where not exists (select 1 from public.email_sends s where s.dedupe_key = c.dedupe_key)
     order by c.user_id, c.priority
  ),
  picked as (
    select d.* from due d order by d.priority, d.user_id limit v_limit
  ),
  claimed as (
    insert into public.email_sends as es (user_id, flow, step, dedupe_key)
    select k.user_id, k.flow, k.step, k.dedupe_key from picked k
    on conflict (dedupe_key) do nothing
    returning es.id as send_id, es.dedupe_key as key
  )
  select cl.send_id,
         k.user_id,
         k.email,
         nullif(split_part(coalesce(k.full_name, ''), ' ', 1), ''),
         k.flow,
         k.step,
         k.dedupe_key,
         k.audience,
         k.account_status,
         k.trial_ends_at,
         k.deposit_amount,
         k.grandfathered,
         k.lifetime_plan,
         k.days_since_signup,
         k.onb_tv,
         k.onb_analysis,
         k.onb_kys,
         k.onb_lesson1,
         k.onb_desk,
         da.title,
         da.bias,
         da.description,
         k.unsub_token,
         k.upgrade_viewed_at,
         k.broker_clicked_at,
         case when k.step = 'spotlight' then v_spotlight else null end,
         -- added 2026-09-22: the arm, and the cover for the digest's card.
         coalesce(v.variant_key, 'A'),
         da.cover_path
    from claimed cl
    join picked k on k.dedupe_key = cl.key
    left join lateral (
      select ev.variant_key
        from public.email_variants ev
       where ev.active
         and ev.retired_at is null
         and ev.flow = k.flow
         and ev.step = k.step
         and abs(pg_catalog.hashtext(k.user_id::text || ':' || k.step)) % 100 < ev.weight
       order by ev.approved_at desc
       limit 1
    ) v on true
    left join da on true;
end;
$$;

comment on function public.fn_claim_email_sends(integer, integer[], integer) is
  'Claim-before-send for the lifecycle rail. Returns at most one due (flow, step) per user, already stamped into email_sends with ok = null, with everything a template needs to render — including the copy arm (variant) and the daily read''s cover_path.';

revoke all on function public.fn_claim_email_sends(integer, integer[], integer)
  from public, anon, authenticated;
grant execute on function public.fn_claim_email_sends(integer, integer[], integer) to service_role;
