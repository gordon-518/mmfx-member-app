-- Layer 3: intervention send-log (dedup) + per-user email prefs (opt-out).
create table if not exists public.journal_interventions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,
  episode_key text not null,
  channel     text not null,
  sent_at     timestamptz not null default now()
);
create index if not exists journal_interventions_user_idx
  on public.journal_interventions (user_id, kind, sent_at desc);
alter table public.journal_interventions enable row level security;
drop policy if exists "journal_interventions_select_own" on public.journal_interventions;
create policy "journal_interventions_select_own"
  on public.journal_interventions for select
  to authenticated using (user_id = auth.uid());

create table if not exists public.journal_email_prefs (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  opted_out   boolean not null default false,
  unsub_token text not null unique default gen_random_uuid()::text,
  updated_at  timestamptz not null default now()
);
alter table public.journal_email_prefs enable row level security;
drop policy if exists "journal_email_prefs_all_own" on public.journal_email_prefs;
create policy "journal_email_prefs_all_own"
  on public.journal_email_prefs for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
