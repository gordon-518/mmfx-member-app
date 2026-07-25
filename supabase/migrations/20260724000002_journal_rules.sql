-- Discipline rules — one row per user, jsonb config so new rules need no
-- migration. Own-row RLS, mirroring journal_goals.
create table if not exists public.journal_rules (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  config     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.journal_rules enable row level security;
drop policy if exists "journal_rules_all_own" on public.journal_rules;
create policy "journal_rules_all_own"
  on public.journal_rules for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
