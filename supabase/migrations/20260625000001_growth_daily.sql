-- ============================================================================
-- Growth-stats daily agent — snapshot table.
--
-- One row per SGT calendar day, written by the /api/cron/daily-stats route
-- (service role) at 09:00 SGT. Stores aggregate counts only (NO member PII) so
-- the dashboard can show day-over-day / week-over-week trends, plus the morning
-- AI narrative. See docs/superpowers/specs/2026-06-25-mmfx-growth-stats-agent-design.md
--
-- RLS: admins may SELECT (reuse public.is_admin()); nobody else gets access.
-- Writes come only from the service role, which bypasses RLS — the cron route
-- is server-only and never reachable by a browser.
-- ============================================================================

create table if not exists public.growth_daily (
  date                 date primary key,
  signups_today        integer not null default 0,
  signups_7d           integer not null default 0,
  signups_30d          integer not null default 0,
  trials_active        integer not null default 0,
  trials_expiring_48h  integer not null default 0,
  conversions_today    integer not null default 0,
  members_active       integer not null default 0,
  churn_today          integer not null default 0,
  tv_engagement_pct    numeric not null default 0,
  broker_split         jsonb   not null default '{}'::jsonb,
  narrative            text,
  created_at           timestamptz not null default now()
);

comment on table public.growth_daily is
  'Daily business-growth snapshot (aggregate counts only, no PII). Written by the daily-stats cron at 09:00 SGT; read by the admin growth dashboard.';

alter table public.growth_daily enable row level security;

-- Lock out anon/authenticated by default, then re-grant SELECT to admins only.
revoke all on public.growth_daily from anon, authenticated;
grant select on public.growth_daily to authenticated;

create policy "growth_daily_select_admin"
  on public.growth_daily
  for select
  to authenticated
  using ( public.is_admin() );

-- ============================================================================
-- Scheduler — pg_cron + pg_net trigger the Vercel route at 01:00 UTC (= 09:00
-- SGT). The route is NOT registered in vercel.json, so it consumes no Vercel
-- Hobby cron slot, yet runs in Node (Anthropic + Telegram calls need it).
--
-- The CRON_SECRET and app URL must NOT be committed. Enable the extensions
-- here, then apply the schedule out-of-band in the Supabase SQL Editor with the
-- live values (templated snippet below). Re-running cron.schedule with the same
-- job name updates it in place.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- RUN THIS ONCE IN THE SUPABASE SQL EDITOR (replace the two placeholders):
--
--   select cron.schedule(
--     'daily-growth-stats',
--     '0 1 * * *',
--     $$
--       select net.http_post(
--         url     := 'https://APP_URL/api/cron/daily-stats',
--         headers := jsonb_build_object(
--           'Content-Type',  'application/json',
--           'Authorization', 'Bearer CRON_SECRET_VALUE'
--         ),
--         body    := '{}'::jsonb
--       );
--     $$
--   );
--
-- Verify:   select jobname, schedule, active from cron.job;
-- Unschedule: select cron.unschedule('daily-growth-stats');
-- ---------------------------------------------------------------------------
