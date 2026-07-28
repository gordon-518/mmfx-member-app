-- ============================================================================
-- MM Channel Bot — visual library (Option A: offline CLI batch → reuse).
-- A pool of pre-generated, on-brand images the CTA engine reuses across posts
-- (least-recently-used rotation), so posting spends zero generation credits.
-- Filled by scripts/generate-visuals.mjs; read by the rotate-cta route.
-- Service-role writes only; RLS locks out anon/authenticated.
-- ============================================================================

create table if not exists public.visual_library (
  id            uuid primary key default gen_random_uuid(),
  image_url     text not null,                 -- public channel-assets URL
  storage_path  text not null,                 -- e.g. visuals/cta-01.png
  prompt        text,                          -- prompt used (for regen/reference)
  tag           text,                          -- 'cta' | 'educational' | 'generic'
  status        text not null default 'active' check (status in ('active','retired')),
  last_used_at  timestamptz,
  times_used    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.visual_library is
  'Reusable pre-generated post images (Higgsfield CLI batch). Rotated onto CTA posts by the bot.';

alter table public.visual_library enable row level security;
revoke all on public.visual_library from anon, authenticated;
