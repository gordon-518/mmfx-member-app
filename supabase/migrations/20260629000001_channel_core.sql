-- ============================================================================
-- MM Channel Bot — Phase 0/1 core.
--  channel_posts   : the post queue + audit log (drained by /api/channel/dispatch)
--  content_library : approved CTA/educational pool that rotates every 4h
--  channel-assets  : public storage bucket for post images (macro charts, etc.)
--
-- All writes come from the service role (server-only cron routes), which
-- bypasses RLS. RLS is enabled and locked down so no browser can read/write.
-- ============================================================================

create table if not exists public.channel_posts (
  id                   uuid primary key default gen_random_uuid(),
  kind                 text not null check (kind in ('analysis_daily','analysis_macro','library')),
  status               text not null default 'queued'
                         check (status in ('queued','posting','posted','failed','skipped')),
  body                 text not null,                 -- house-markdown; converted to HTML at send
  image_url            text,                          -- full public URL, nullable
  link_url             text,                          -- optional CTA link appended at send
  scheduled_for        timestamptz not null default now(),
  dedupe_key           text not null unique,          -- prevents double-post
  telegram_message_id  bigint,
  source_id            uuid,                          -- fk-ish → content_library.id for rotations
  attempts             integer not null default 0,
  error                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on table public.channel_posts is
  'Telegram channel post queue + audit log. Service-role writes only; drained by the dispatch cron.';

create index if not exists channel_posts_due_idx
  on public.channel_posts (status, scheduled_for);

create table if not exists public.content_library (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('educational','cta')),
  body           text not null,                       -- house-markdown
  status         text not null default 'draft'
                   check (status in ('draft','approved','retired')),
  last_posted_at timestamptz,
  times_posted   integer not null default 0,
  source         text not null default 'manual' check (source in ('manual','claude')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.content_library is
  'Approved CTA/educational post pool. Rotated into channel_posts every 4h.';

alter table public.channel_posts   enable row level security;
alter table public.content_library enable row level security;
revoke all on public.channel_posts   from anon, authenticated;
revoke all on public.content_library from anon, authenticated;

-- Public bucket for post images (macro charts). Covers already live in analysis-covers.
insert into storage.buckets (id, name, public)
values ('channel-assets', 'channel-assets', true)
on conflict (id) do nothing;

-- ============================================================================
-- Schedulers — apply OUT OF BAND in the Supabase SQL Editor (needs live APP_URL
-- + CRON_SECRET, which must not be committed). Same pattern as growth_daily.
-- ============================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- RUN ONCE IN SQL EDITOR (replace APP_URL + CRON_SECRET_VALUE):
--
--   select cron.schedule('channel-dispatch', '* * * * *', $$
--     select net.http_post(
--       url := 'https://APP_URL/api/channel/dispatch',
--       headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer CRON_SECRET_VALUE'),
--       body := '{}'::jsonb);$$);
--
--   select cron.schedule('channel-rotate-cta', '0 0,4,8,12,16,20 * * *', $$   -- every 4h (UTC; shift for MYT if desired)
--     select net.http_post(
--       url := 'https://APP_URL/api/channel/rotate-cta',
--       headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer CRON_SECRET_VALUE'),
--       body := '{}'::jsonb);$$);
--
--   select cron.schedule('channel-replenish-cta', '0 1 * * *', $$
--     select net.http_post(
--       url := 'https://APP_URL/api/channel/replenish-cta',
--       headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer CRON_SECRET_VALUE'),
--       body := '{}'::jsonb);$$);
--
-- Verify: select jobname, schedule, active from cron.job;
