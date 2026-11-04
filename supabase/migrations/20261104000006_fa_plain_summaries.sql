-- ============================================================================
-- Fundamental Desk "In plain words" (4 Nov 2026).
--   fa_plain_summaries : the plain-language retelling of one desk thesis in one
--                        language, written by Claude the first time a member
--                        opens that thesis in that language, then reused by
--                        everyone. A new thesis (new generated_at) gets new rows.
-- RLS on with no policies: only the service role (/api/fundamental/plain, after
-- checking the member may open the desk) reads or writes. anon and
-- authenticated get nothing.
-- Additive only: one new table.
-- ============================================================================

create table if not exists public.fa_plain_summaries (
  instrument   text        not null,
  generated_at timestamptz not null,
  locale       text        not null check (locale in ('en', 'zh-Hans', 'zh-Hant', 'ms', 'id')),
  body         jsonb       not null,
  model        text        not null,
  created_at   timestamptz not null default now(),
  primary key (instrument, generated_at, locale)
);

alter table public.fa_plain_summaries enable row level security;
revoke all on table public.fa_plain_summaries from public, anon, authenticated;
