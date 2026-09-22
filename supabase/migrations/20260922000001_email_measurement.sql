-- ============================================================================
-- Email measurement rail + variant arms (design doc 2026-09-22, §4).
--
-- The lifecycle rail (20260921000001) logs that an email was CLAIMED and that
-- SendPulse accepted it. Nothing after that was observable: no delivery, no
-- open, no click, and no link between a click and what the person did in the
-- app. This migration closes that loop and adds the one lever the weekly Opus
-- loop needs — an approved challenger arm per (flow, step).
--
--   email_sends +3 cols  provider_id (SendPulse's send id), variant, subject.
--   email_events         one row per SendPulse SMTP webhook event.
--   email_variants       approved challenger copy, with a traffic weight.
--   fn_claim_email_sends re-created: + variant, + cover_path.
--   fn_email_kpis        one row per (flow, step, variant) for the brain.
--   fn_app_event_insert  re-created: + 'email_visit' on the allowlist.
--
-- Nothing here sends anything, and nothing here is read by a browser: every
-- new table is service-role only, like email_sends itself.
--
-- Additive, except fn_claim_email_sends, which is DROPPED and re-created
-- because its RETURNS TABLE gains two columns (see the note above it).
--
-- Ops notes for go-live are at the FOOT of this file.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- email_sends — what the route learns at send time.
--
-- provider_id is SendPulse's own id for the message ({"result":true,
-- "id":"tlr7m5-1bve4z-ik"}). It is the join key for every webhook event, and
-- the only reliable one: the recipient + subject fallback in the route exists
-- for the case where SendPulse hands the webhook a numeric id instead.
--
-- variant defaults to 'A' so every row already in the table reads as the
-- control, and subject is stored because the fallback match needs it and
-- because a KPI table without the words is unreadable.
-- ---------------------------------------------------------------------------
alter table public.email_sends
  add column if not exists provider_id text,
  add column if not exists variant     text not null default 'A',
  add column if not exists subject     text;

comment on column public.email_sends.provider_id is
  'SendPulse''s send id from the SMTP API response. Joined to email_events.provider_id.';
comment on column public.email_sends.variant is
  'Which copy arm this send used: ''A'' (the template default) or an email_variants.variant_key.';

create index if not exists email_sends_provider_idx on public.email_sends(provider_id);


-- ---------------------------------------------------------------------------
-- email_events — the SendPulse SMTP webhook's landing table.
--
-- SendPulse batches events every 30s (or 500 events) and does not document
-- retries, so the receiver never fails a POST; the unique key below is what
-- makes a re-post a no-op instead of a double count.
--
-- send_id is nullable ON PURPOSE and set to null if the send row is ever
-- deleted: an event for a message we can no longer identify is still worth
-- keeping (raw holds the whole payload), and losing the event would be worse
-- than an orphan.
-- ---------------------------------------------------------------------------
create table if not exists public.email_events (
  id          bigint generated always as identity primary key,
  send_id     uuid references public.email_sends(id) on delete set null,
  provider_id text,
  event       text not null check (event in ('delivered','undelivered','opened','clicked','spam','unsubscribed','resubscribed','hard_bounce','soft_bounce')),
  url         text,
  occurred_at timestamptz not null,
  raw         jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  unique (provider_id, event, occurred_at)
);

comment on table public.email_events is
  'SendPulse SMTP webhook events, one row per (message, event, instant). Idempotent on (provider_id, event, occurred_at): the receiver re-posts safely.';

create index if not exists email_events_send_idx on public.email_events(send_id, event);
create index if not exists email_events_provider_idx on public.email_events(provider_id);

alter table public.email_events enable row level security;


-- ---------------------------------------------------------------------------
-- email_variants — the approved challenger copy.
--
-- The hybrid from the spec (§2): code holds the default (arm 'A'), the
-- database holds APPROVED challengers with a weight. Nothing writes here
-- except POST /api/email/variants, and the brain only calls that after Gordon
-- approves the amber task — so a row in this table is, by construction, copy
-- a human has read.
--
-- copy is a LifecycleCopy: {subject, preheader, paragraphs[], ctaLabel}. The
-- route validates the shape before it gets here; the column stays jsonb so a
-- copy shape change is not a migration.
-- ---------------------------------------------------------------------------
create table if not exists public.email_variants (
  id          uuid primary key default gen_random_uuid(),
  flow        text not null,
  step        text not null,
  variant_key text not null,
  copy        jsonb not null,
  weight      int  not null default 50 check (weight between 0 and 100),
  active      boolean not null default true,
  created_by  text not null default 'brain',
  rationale   text,
  approved_at timestamptz not null default now(),
  retired_at  timestamptz,
  unique (flow, step, variant_key)
);

comment on table public.email_variants is
  'Approved challenger copy per (flow, step, variant_key), with a traffic weight. Written only by POST /api/email/variants, after human approval in the brain.';

create index if not exists email_variants_live_idx
  on public.email_variants (flow, step) where active;

alter table public.email_variants enable row level security;


-- ---------------------------------------------------------------------------
-- fn_claim_email_sends — the 20260921 body, with exactly two additions:
--
--   (a) variant     — the arm this user gets for this step.
--   (b) cover_path  — the daily read's cover image, for the digest's card.
--
-- DROP first: `create or replace` cannot change a function's return type, and
-- RETURNS TABLE columns are the return type. Dropping also drops the grants,
-- so they are restated below.
--
-- The arm is a STABLE hash of (user, step), not a random draw: the same user
-- must get the same arm every time that step is re-claimed, or a test's two
-- arms would be measuring the same people twice. `% 100 < weight` makes
-- weight literally the percentage of users in the challenger.
-- ---------------------------------------------------------------------------
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


-- ---------------------------------------------------------------------------
-- fn_email_kpis — one row per (flow, step, variant) over a window.
--
-- Everything is counted as DISTINCT SENDS, never as raw events: Apple's Mail
-- Privacy Protection pre-fetches the open pixel and Gmail's proxy re-fetches
-- images, so "opens" as an event count is noise. A send that was opened five
-- times is one open here.
--
-- Open rate is REPORTED and never optimised on, for the same reason (spec §2).
-- The honest numbers are click %, visit % and goal %.
--
-- `visited` ties a click to the app: middleware logs app_events.email_visit
-- with the cid the email's links carry (EML-<flow>-<step>), and a visit counts
-- only inside 72h of the send.
--
-- `goal_done` is the goal table from spec §4.3, one CASE arm per step. Two
-- judgement calls worth knowing about:
--   * trial/tv's goal is the tv_username_set EVENT, not profiles.tv_connected_at,
--     so it is the same 72h-window shape as every other arm.
--   * member-d7's features are 'live-classes' and 'fundamental-desk' — the
--     spec writes "live-class", but FEATURE_KEYS (src/lib/access/featureKeys.ts)
--     spells it 'live-classes', and the event carries the key, not the prose.
--
-- The window is [p_since, p_until) on sent_at, and only sends SendPulse
-- accepted (ok) are counted: a row with ok = false never reached an inbox and
-- would only dilute every rate below it.
-- ---------------------------------------------------------------------------
create or replace function public.fn_email_kpis(
  p_since timestamptz default now() - interval '28 days',
  p_until timestamptz default now()
)
returns table (
  flow          text,
  step          text,
  variant       text,
  sends         int,
  delivered     int,
  opened        int,
  clicked       int,
  visited       int,
  goal_done     int,
  unsubscribed  int,
  complaints    int,
  bounced       int,
  open_p50_min  numeric,
  click_p50_min numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select es.id, es.user_id, es.flow, es.step, es.variant, es.sent_at
      from public.email_sends es
     where es.sent_at >= p_since
       and es.sent_at <  p_until
       and es.ok is true
  ),
  ev as (
    -- One row per (send, event): the FIRST time it happened.
    select e.send_id, e.event, min(e.occurred_at) as first_at
      from public.email_events e
     where e.send_id is not null
     group by e.send_id, e.event
  ),
  agg as (
    select s.id,
           bool_or(ev.event = 'delivered')                              as delivered,
           bool_or(ev.event = 'opened')                                 as opened,
           bool_or(ev.event = 'clicked')                                as clicked,
           bool_or(ev.event in ('unsubscribed'))                        as unsubscribed,
           bool_or(ev.event = 'spam')                                   as complaint,
           bool_or(ev.event in ('hard_bounce', 'soft_bounce', 'undelivered')) as bounced,
           min(ev.first_at) filter (where ev.event = 'opened')          as opened_at,
           min(ev.first_at) filter (where ev.event = 'clicked')         as clicked_at
      from s
      left join ev on ev.send_id = s.id
     group by s.id
  ),
  vis as (
    select s.id,
           exists (
             select 1
               from public.app_events a
              where a.user_id = s.user_id
                and a.event = 'email_visit'
                and a.props ->> 'cid' = 'EML-' || s.flow || '-' || s.step
                and a.created_at >= s.sent_at
                and a.created_at <= s.sent_at + interval '72 hours'
           ) as visited
      from s
  ),
  per as (
    select s.flow,
           s.step,
           s.variant,
           s.sent_at,
           coalesce(a.delivered, false)    as delivered,
           coalesce(a.opened, false)       as opened,
           coalesce(a.clicked, false)      as clicked,
           coalesce(a.unsubscribed, false) as unsubscribed,
           coalesce(a.complaint, false)    as complaint,
           coalesce(a.bounced, false)      as bounced,
           a.opened_at,
           a.clicked_at,
           v.visited,
           case
             -- The read itself is the goal for the three analysis-shaped steps.
             when s.flow || '/' || s.step in ('trial/welcome', 'trial/analysis', 'nurture/digest') then
               exists (select 1 from public.app_events a2
                        where a2.user_id = s.user_id
                          and a2.event = 'feature_view'
                          and a2.props ->> 'feature' = 'daily-analysis'
                          and a2.created_at >= s.sent_at
                          and a2.created_at <= s.sent_at + interval '72 hours')
             -- Know Your Style is a profile column, not an event.
             when s.step = 'kys' then
               exists (select 1 from public.profiles p
                        where p.id = s.user_id
                          and p.kys_completed_at > s.sent_at
                          and p.kys_completed_at <= s.sent_at + interval '72 hours')
             when s.step = 'tv' then
               exists (select 1 from public.app_events a2
                        where a2.user_id = s.user_id
                          and a2.event = 'tv_username_set'
                          and a2.created_at >= s.sent_at
                          and a2.created_at <= s.sent_at + interval '72 hours')
             when s.step = 'lesson1' then
               exists (select 1 from public.app_events a2
                        where a2.user_id = s.user_id
                          and a2.event = 'onboarding_step_done'
                          and a2.props ->> 'step' = 'lesson-1'
                          and a2.created_at >= s.sent_at
                          and a2.created_at <= s.sent_at + interval '72 hours')
             -- The ladder steps: seeing the upgrade page is the goal;
             -- deposit_submitted is the secondary the brain reads separately.
             when s.step in ('ladder', 'day12', 'upgrade-seen') then
               exists (select 1 from public.app_events a2
                        where a2.user_id = s.user_id
                          and a2.event = 'upgrade_viewed'
                          and a2.created_at >= s.sent_at
                          and a2.created_at <= s.sent_at + interval '72 hours')
             when s.step = 'broker-clicked' then
               exists (select 1 from public.app_events a2
                        where a2.user_id = s.user_id
                          and a2.event = 'deposit_submitted'
                          and a2.created_at >= s.sent_at
                          and a2.created_at <= s.sent_at + interval '72 hours')
             -- A guide read only counts if they actually landed on it.
             when s.step = 'spotlight' then
               coalesce(a.clicked, false) and v.visited
             -- member-d3's goal is a RUNNING assistant, connected after the email.
             when s.step = 'member-d3' then
               exists (select 1 from public.journal_accounts ja
                        where ja.user_id = s.user_id
                          and ja.state = 'deployed'
                          and ja.created_at >= s.sent_at
                          and ja.created_at <= s.sent_at + interval '72 hours')
             when s.step = 'member-d7' then
               exists (select 1 from public.app_events a2
                        where a2.user_id = s.user_id
                          and a2.event = 'feature_view'
                          and a2.props ->> 'feature' in ('live-classes', 'fundamental-desk')
                          and a2.created_at >= s.sent_at
                          and a2.created_at <= s.sent_at + interval '72 hours')
             -- Dormancy's goal is simply coming back at all.
             when s.step = 'member-dormant' then
               exists (select 1 from public.app_events a2
                        where a2.user_id = s.user_id
                          and a2.created_at >= s.sent_at
                          and a2.created_at <= s.sent_at + interval '72 hours')
             else false
           end as goal_done
      from s
      join agg a on a.id = s.id
      join vis v on v.id = s.id
  )
  select p.flow,
         p.step,
         p.variant,
         count(*)::int                                       as sends,
         count(*) filter (where p.delivered)::int            as delivered,
         count(*) filter (where p.opened)::int               as opened,
         count(*) filter (where p.clicked)::int              as clicked,
         count(*) filter (where p.visited)::int              as visited,
         count(*) filter (where p.goal_done)::int            as goal_done,
         count(*) filter (where p.unsubscribed)::int         as unsubscribed,
         count(*) filter (where p.complaint)::int            as complaints,
         count(*) filter (where p.bounced)::int              as bounced,
         round(
           percentile_cont(0.5) within group (
             order by extract(epoch from (p.opened_at - p.sent_at)) / 60
           )::numeric, 1)                                    as open_p50_min,
         round(
           percentile_cont(0.5) within group (
             order by extract(epoch from (p.clicked_at - p.sent_at)) / 60
           )::numeric, 1)                                    as click_p50_min
    from per p
   group by p.flow, p.step, p.variant
   order by p.flow, p.step, p.variant;
$$;

comment on function public.fn_email_kpis(timestamptz, timestamptz) is
  'Lifecycle email KPIs per (flow, step, variant) over [p_since, p_until): distinct sends per event, the goal table from spec §4.3, and median open/click latency in minutes.';

revoke all on function public.fn_email_kpis(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.fn_email_kpis(timestamptz, timestamptz) to service_role;


-- ---------------------------------------------------------------------------
-- The app_events allowlist — + 'email_visit'.
--
-- Body copied verbatim from 20260910000008_deposit_submissions.sql (the live
-- definition), with the name added and one dedupe arm: a reader who refreshes
-- the page they landed on has not visited twice, and the KPI function counts
-- distinct sends anyway — but a per-cid cap keeps the raw table honest.
--
-- email_visit is SERVER-ONLY. fn_log_event (the browser's door) is untouched,
-- so a browser still cannot forge one; middleware logs it through
-- fn_log_event_as with the service-role key.
-- ---------------------------------------------------------------------------
create or replace function public.fn_app_event_insert(
  p_user_id uuid,
  p_event   text,
  p_props   jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- v_ prefix: a bare "props" is ambiguous with app_events.props in the
  -- dedupe query below and makes every call fail.
  v_props jsonb := coalesce(p_props, '{}'::jsonb);
begin
  if p_user_id is null then
    raise exception 'fn_app_event_insert: user id required';
  end if;

  if p_event is null or p_event not in (
    'feature_view',
    'tv_username_set',
    'upgrade_viewed',
    'upgrade_broker_link_clicked',
    'upgrade_contact_clicked',
    'deposit_verified',
    'tier_changed',
    'onboarding_step_done',
    'deposit_submitted',
    'email_visit'   -- added (email v2 §4): post-click attribution
  ) then
    raise exception 'fn_app_event_insert: event % is not on the allowlist', p_event;
  end if;

  if jsonb_typeof(v_props) <> 'object' then
    raise exception 'fn_app_event_insert: props must be a JSON object';
  end if;

  if pg_column_size(v_props) > 1024 then
    raise exception 'fn_app_event_insert: props exceed 1 KB';
  end if;

  -- One feature_view per user + feature per 30 minutes. Refreshes and
  -- back-navigation would otherwise bury the signal under duplicate rows.
  if p_event = 'feature_view' and exists (
    select 1
    from public.app_events e
    where e.user_id = p_user_id
      and e.event = 'feature_view'
      and e.props ->> 'feature' = v_props ->> 'feature'
      and e.created_at > now() - interval '30 minutes'
  ) then
    return;
  end if;

  -- A checklist step is done once; later repeats are no-ops.
  if p_event = 'onboarding_step_done' and exists (
    select 1
    from public.app_events e
    where e.user_id = p_user_id
      and e.event = 'onboarding_step_done'
      and e.props ->> 'step' = v_props ->> 'step'
  ) then
    return;
  end if;

  -- added (email v2 §4): one visit per email per user per day. The cid names
  -- the email, so a refresh, a second tab or a back-navigation is the same
  -- visit, not a new one.
  if p_event = 'email_visit' and exists (
    select 1
    from public.app_events e
    where e.user_id = p_user_id
      and e.event = 'email_visit'
      and e.props ->> 'cid' = v_props ->> 'cid'
      and e.created_at > now() - interval '24 hours'
  ) then
    return;
  end if;

  insert into public.app_events (user_id, event, props)
  values (p_user_id, p_event, v_props);
end;
$$;

revoke all on function public.fn_app_event_insert(uuid, text, jsonb)
  from public, anon, authenticated;


-- Restated verbatim (20260910000002) so this migration carries the whole
-- server-side path in one place: the only door email_visit comes through.
create or replace function public.fn_log_event_as(
  p_user_id uuid,
  p_event   text,
  p_props   jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.fn_app_event_insert(p_user_id, p_event, p_props);
end;
$$;

revoke all on function public.fn_log_event_as(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.fn_log_event_as(uuid, text, jsonb) to service_role;


-- The browser's door, restated UNCHANGED, so it is obvious in review that
-- email_visit was NOT added to it: only the two click events may be forged
-- from a client, and email_visit is not one of them.
create or replace function public.fn_log_event(
  p_event text,
  p_props jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'fn_log_event: no authenticated user';
  end if;

  if p_event is null or p_event not in (
    'upgrade_broker_link_clicked',
    'upgrade_contact_clicked',
    'onboarding_step_done'
  ) then
    raise exception 'fn_log_event: % cannot be logged from the client', p_event;
  end if;

  perform public.fn_app_event_insert(uid, p_event, p_props);
end;
$$;

revoke all on function public.fn_log_event(text, jsonb) from public, anon;
grant execute on function public.fn_log_event(text, jsonb) to authenticated;


-- ============================================================================
-- OPS — what Gordon has to do once, by hand, after this ships (spec §6).
--
-- 1. ENV VARS on the member app (Vercel → Settings → Environment Variables):
--
--      EMAIL_EVENTS_SECRET   a new random string, e.g. `openssl rand -hex 24`.
--                            It is the ONLY auth on the webhook: SendPulse
--                            signs nothing, so the secret rides in the URL.
--      CRON_SECRET           unchanged — already set for the lifecycle cron.
--                            The metrics and variants routes reuse it, so the
--                            brain needs no new credential.
--
--    Nothing else is new. NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
--    are already set and are what the webhook writes with.
--
-- 2. SENDPULSE WEBHOOK (Account Settings → API → Webhooks → Create webhook):
--
--      URL:    https://app.marketmakersfx.net/api/email/events?k=EMAIL_EVENTS_SECRET
--              (replace EMAIL_EVENTS_SECRET with the value from step 1; keep
--               the `?k=` — a request without it is answered 401)
--      Type:   SMTP
--      Events: tick ALL NINE —
--              delivered, undelivered, opened, clicked, spam,
--              unsubscribed, resubscribed, hard bounce, soft bounce
--
--    SendPulse batches every 30 seconds or 500 events and does not document
--    retries. The route answers 200 to everything it can parse, and the
--    unique (provider_id, event, occurred_at) key makes a re-post a no-op, so
--    a duplicated batch can never double-count.
--
--    Verify: send yourself one lifecycle email, then
--      select event, count(*) from public.email_events group by 1;
--
-- 3. CUSTOM TRACKING DOMAIN (decision 2, 2026-09-22):
--
--    SendPulse → Settings → tracking domain: `click.marketmakersfx.net`.
--    SendPulse gives a CNAME target; add it at Bluehost:
--
--      click   CNAME   <value SendPulse shows>    TTL 3600
--
--    Tracked links then carry our own domain instead of SendPulse's, which is
--    what keeps the click-through out of spam filters that score unknown
--    redirectors. Nothing in this migration depends on it — it changes the
--    link host only, and the cid travels in the query string either way.
--
-- 4. Nothing here needs a cron job. The lifecycle job scheduled by
--    20260921000001 is unchanged.
-- ============================================================================
