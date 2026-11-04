-- ============================================================================
-- In-app support chat (4 Nov 2026).
--   chat_threads   : one row per member: whether the assistant or a person has
--                    the conversation, and when the team was last pinged
--   chat_messages  : the conversation itself (member, assistant, staff, and
--                    system events such as a handoff); purged after 180 days
--   support_settings.chat_enabled : the in-app assistant's own on/off switch
--                    (off = every message goes straight to a person)
-- RLS: a member reads their own thread and messages; admins read every one.
-- All writes go through the service role (/api/chat and the /admin/chat
-- actions, after checking who is asking). anon gets nothing.
-- Additive only: two new tables, one new column with a default.
-- ============================================================================

alter table public.support_settings
  add column if not exists chat_enabled boolean not null default true;

create table if not exists public.chat_threads (
  user_id             uuid        primary key references public.profiles(id) on delete cascade,
  state               text        not null default 'bot'
                                  check (state in ('bot', 'needs_human')),
  locale              text,
  handoff_reason      text,
  last_ping_at        timestamptz,
  member_last_read_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists chat_threads_state_idx on public.chat_threads (state, updated_at desc);

create table if not exists public.chat_messages (
  id             bigint      generated always as identity primary key,
  user_id        uuid        not null references public.profiles(id) on delete cascade,
  role           text        not null check (role in ('member', 'assistant', 'staff', 'system')),
  body           text        not null check (char_length(body) between 1 and 4000),
  topic          text,
  confidence     numeric(3,2),
  model          text,
  guard_failures jsonb,
  staff_id       uuid        references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists chat_messages_user_idx on public.chat_messages (user_id, created_at desc);
create index if not exists chat_messages_created_idx on public.chat_messages (created_at desc);

alter table public.chat_threads  enable row level security;
alter table public.chat_messages enable row level security;

revoke all on public.chat_threads, public.chat_messages from anon, authenticated;
grant select on public.chat_threads, public.chat_messages to authenticated;

drop policy if exists "chat_threads_select_own_or_admin" on public.chat_threads;
create policy "chat_threads_select_own_or_admin" on public.chat_threads
  for select to authenticated using ( user_id = (select auth.uid()) or public.is_admin() );
drop policy if exists "chat_messages_select_own_or_admin" on public.chat_messages;
create policy "chat_messages_select_own_or_admin" on public.chat_messages
  for select to authenticated using ( user_id = (select auth.uid()) or public.is_admin() );

-- 180-day retention: the conversation holds the member's own words.
select cron.schedule(
  'chat-messages-purge',
  '45 0 * * *',
  $$delete from public.chat_messages where created_at < now() - interval '180 days'$$
);
