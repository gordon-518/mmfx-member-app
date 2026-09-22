-- ============================================================================
-- Email lifecycle rail (design doc 2026-09-21, §4).
--
-- Three tables and one claim function. The shape is the claim-before-send
-- pattern already used by 'deposit-dm-reminder' (20260915000007): the function
-- decides what is due, stamps a row BEFORE the route renders and sends, and a
-- failed send is logged (ok = false) rather than retried. The unique
-- dedupe_key is what makes a double-send impossible, even across overlapping
-- runs.
--
--   email_prefs       one row per user: the marketing opt-out + its token.
--                     Mirrors journal_email_prefs (20260727000001). Kept
--                     SEPARATE from it on purpose: the journal's coaching
--                     emails are a different consent scope, and opting out of
--                     one must not silently opt you out of the other.
--   email_sends       the send log AND the dedupe ledger AND the daily cap.
--   email_spotlights  the brain's approved weekly feature email, posted in by
--                     POST /api/email/spotlight. The app only ever SENDS what
--                     has already been approved; it never composes one.
--
-- The hard rule from §1.5 — ONE email per user per day across every lane —
-- lives in fn_claim_email_sends, not in convention: a user with an
-- email_sends OR journal_interventions row in the last 24 hours is not a
-- candidate at all.
--
-- Nothing sends until EMAIL_LIFECYCLE_ENABLED=true is set on the app.
-- Additive.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- email_prefs — the global marketing opt-out.
-- ---------------------------------------------------------------------------
create table if not exists public.email_prefs (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  marketing_opted_out boolean not null default false,
  unsub_token         text not null unique default gen_random_uuid()::text,
  updated_at          timestamptz not null default now()
);

comment on table public.email_prefs is
  'Global marketing email opt-out, one row per user. Separate consent scope from journal_email_prefs. The unsub_token is the capability in the List-Unsubscribe URL.';

alter table public.email_prefs enable row level security;
drop policy if exists "email_prefs_all_own" on public.email_prefs;
create policy "email_prefs_all_own"
  on public.email_prefs for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- email_sends — send log, dedupe ledger and daily cap, in one table.
--
-- sent_at is stamped at CLAIM time, not at delivery: it is what the 24-hour
-- cap reads, so a slow or failed send still counts against the user's day.
-- ok is null between claim and result.
-- ---------------------------------------------------------------------------
create table if not exists public.email_sends (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  flow       text not null,
  step       text not null,
  dedupe_key text not null unique,
  sent_at    timestamptz not null default now(),
  ok         boolean,
  error      text
);

comment on table public.email_sends is
  'One row per lifecycle email claimed for a user. dedupe_key is the unique "never send this twice" identity; ok is null until the route stamps the result.';
comment on column public.email_sends.dedupe_key is
  'user_id:flow:step for once-per-user steps, with a date or spotlight id appended for recurring ones. The unique index is the anti-double-send guard.';

-- The daily cap's lookup, and the "has this step ever been sent" anti-join.
create index if not exists email_sends_user_sent_idx
  on public.email_sends (user_id, sent_at desc);
create index if not exists email_sends_step_sent_idx
  on public.email_sends (step, sent_at desc);

-- Service role only: this is an internal log, never read by a browser.
alter table public.email_sends enable row level security;


-- ---------------------------------------------------------------------------
-- email_spotlights — the brain's approved weekly feature email.
--
-- Composed, compliance-gated and approved in MM Main Marketing Brain (§5),
-- then POSTed here. The lifecycle cron sends the NEWEST approved row to the
-- Free tier on the spotlight day; each row goes to a given user at most once
-- (the row id is in the dedupe_key).
-- ---------------------------------------------------------------------------
create table if not exists public.email_spotlights (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null,
  html        text not null,
  text        text not null,
  guide_url   text,
  cid         text,
  approved_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

comment on table public.email_spotlights is
  'Approved weekly feature-spotlight emails, written by the brain via POST /api/email/spotlight. The member app sends them; it never composes them.';

create index if not exists email_spotlights_approved_idx
  on public.email_spotlights (approved_at desc);

alter table public.email_spotlights enable row level security;


-- ---------------------------------------------------------------------------
-- fn_claim_email_sends — decides what is due, claims it, returns the context.
--
-- Returns at most ONE row per user per call (§1.5), already inserted into
-- email_sends with ok = null. The caller renders and sends, then stamps
-- ok/error by send_id.
--
-- Stage logic mirrors the app's own: `audience` follows src/lib/audience.ts
-- (audienceFor) and tier_rank follows src/lib/tiers.ts (tierFor / TIER_RANK).
-- The route recomputes the exact MemberTier from the raw inputs returned here
-- with tierFor(), so the TS ladder stays the single source of truth for copy;
-- tier_rank exists only so SQL can answer "is this user at least Desk?".
-- The onboarding booleans are read exactly as fn_onboarding_states
-- (20260915000002) reads them.
--
-- Priority decides which of a user's due steps wins this run (low = first):
-- behavioural beats scheduled, per §3A.
--   10/11  rescue    broker-clicked, upgrade-seen   (hot lead, any non-member)
--   20     trial     welcome
--   30-33  trial     analysis, kys, tv, lesson1     (behavioural)
--   40/41  trial     day12, ladder                  (scheduled)
--   50-52  member    member-d3, member-d7, member-dormant
--   60/61  nurture   spotlight, digest
--
-- An advisory lock serialises overlapping runs, so two crons can't hand the
-- same user two different steps in the same hour. Service role only.
-- ---------------------------------------------------------------------------
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
  spotlight_id              uuid
)
language plpgsql
security definer
set search_path = ''
as $$
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
    select d.title, d.bias, d.description
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
         case when k.step = 'spotlight' then v_spotlight else null end
    from claimed cl
    join picked k on k.dedupe_key = cl.key
    left join da on true;
end;
$$;

comment on function public.fn_claim_email_sends(integer, integer[], integer) is
  'Claim-before-send for the lifecycle rail. Returns at most one due (flow, step) per user, already stamped into email_sends with ok = null, with everything a template needs to render.';

revoke all on function public.fn_claim_email_sends(integer, integer[], integer)
  from public, anon, authenticated;
grant execute on function public.fn_claim_email_sends(integer, integer[], integer) to service_role;


-- ============================================================================
-- Scheduler — pg_cron + pg_net call the Vercel route every five minutes.
-- The claim function paces itself (one email per user per SGT day, p_limit
-- rows per run), so the cadence and EMAIL_LIFECYCLE_BATCH together set the
-- ceiling: 200 rows × 12 runs/h = 2,400/h, which clears a 3,762-recipient
-- daily digest in about 95 minutes after the desk publishes, and sits well
-- under SendPulse's per-hour limit on any paid SMTP plan (2,500/h at the
-- 25k tier and up; the free tier's 50/h and 400/day cannot carry this).
-- Runs with nothing due cost one RPC.
--
-- The CRON_SECRET and app URL must NOT be committed. Enable the extensions
-- here, then apply the schedule out-of-band in the Supabase SQL Editor with
-- the live values. Re-running cron.schedule with the same job name updates it
-- in place.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- RUN THIS ONCE IN THE SUPABASE SQL EDITOR (replace the two placeholders):
--
--   select cron.schedule(
--     'email-lifecycle',
--     '*/5 * * * *',
--     $$
--       select net.http_post(
--         url     := 'https://APP_URL/api/cron/email-lifecycle',
--         headers := jsonb_build_object(
--           'Content-Type',  'application/json',
--           'Authorization', 'Bearer CRON_SECRET_VALUE'
--         ),
--         body    := '{}'::jsonb
--       );
--     $$
--   );
--
-- Verify:     select jobname, schedule, active from cron.job;
-- Unschedule: select cron.unschedule('email-lifecycle');
--
-- Safe to schedule before go-live: the route returns {disabled:true} and
-- claims nothing until EMAIL_LIFECYCLE_ENABLED=true is set on the app.
-- ---------------------------------------------------------------------------
