-- ============================================================================
-- Day 10 · Task 1 — admin-managed content tables: daily_analysis + live_classes
--
-- Reads gated to Full-tier users via the existing public.is_full_access();
-- writes gated to admins via the existing public.is_admin(). Neither function
-- is redefined here. No service_role — Gordon manages rows through the admin
-- UI, which uses the normal authenticated client with RLS doing the gating.
--
-- New tables get NO automatic role grants (auto_expose_new_tables = false), so
-- the table-level grants to `authenticated` are explicit; RLS then gates the
-- actual rows. anon gets nothing.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- daily_analysis — a dated video note with an optional directional bias.
-- ----------------------------------------------------------------------------
create table public.daily_analysis (
  id           uuid primary key default gen_random_uuid(),
  published_on date not null default current_date,
  title        text not null,
  gumlet_id    text not null,
  description  text,
  bias         text check (bias in ('bullish', 'bearish', 'neutral')),
  created_at   timestamptz not null default now()
);

comment on table public.daily_analysis is
  'Admin-managed daily market analysis notes (Gumlet video + optional bias). Full-read, admin-write via RLS.';

alter table public.daily_analysis enable row level security;

create policy "daily_analysis_select_full"
  on public.daily_analysis
  for select
  to authenticated
  using ( public.is_full_access() );

create policy "daily_analysis_write_admin"
  on public.daily_analysis
  for all
  to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

grant select, insert, update, delete on table public.daily_analysis to authenticated;

-- ----------------------------------------------------------------------------
-- live_classes — a scheduled live session with a Zoom link.
-- ----------------------------------------------------------------------------
create table public.live_classes (
  id         uuid primary key default gen_random_uuid(),
  starts_at  timestamptz not null,
  title      text not null,
  zoom_url   text not null,
  created_at timestamptz not null default now()
);

comment on table public.live_classes is
  'Admin-managed scheduled live classes (title + Zoom link + start time). Full-read, admin-write via RLS.';

alter table public.live_classes enable row level security;

create policy "live_classes_select_full"
  on public.live_classes
  for select
  to authenticated
  using ( public.is_full_access() );

create policy "live_classes_write_admin"
  on public.live_classes
  for all
  to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

grant select, insert, update, delete on table public.live_classes to authenticated;
