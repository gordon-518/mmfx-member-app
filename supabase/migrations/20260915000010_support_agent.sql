-- ============================================================================
-- Support agent (spec 2026-09-15-support-agent-design.md).
--   support_settings : one row, the on/off switch + facts editable in /admin
--   support_chats    : one row per SendPulse contact, the agent's per-chat state
--   support_events   : the log, purged after 90 days
-- RLS: admins may SELECT; all writes go through the service role (route + server
-- actions after an is_admin() check). anon gets nothing.
-- ============================================================================

create table if not exists public.support_settings (
  id                 smallint primary key default 1 check (id = 1),
  enabled            boolean     not null default false,
  bonus_code         text        not null default 'TeamMM001',
  bonus_code_expires date        not null default date '2026-12-15',
  official_accounts  jsonb       not null default '[
    {"handle":"MM_3000","label":"Admin Amelia, the admin"},
    {"handle":"MMFX_BOSS","label":"Gordon''s personal line"},
    {"handle":"marketmakers18bot","label":"the MMFX bot"}
  ]'::jsonb,
  office_hours       text        not null default 'during Singapore office hours',
  trade_cadence      text        not null default 'around 2–3 trades a day',
  notes              text        not null default '',
  approved_flows     jsonb       not null default '[
    {"label":"MMFX bot (sign-up flows)","link":"https://t.me/marketmakers18bot",
     "use_when":"someone wants to join or sign up, especially in @MM_3000 chats"}
  ]'::jsonb,
  updated_by         uuid        references public.profiles(id) on delete set null,
  updated_at         timestamptz not null default now()
);
insert into public.support_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.support_chats (
  contact_id          text        primary key,
  is_business         boolean     not null default false,
  telegram_username   text,
  matched_user_id     uuid        references public.profiles(id) on delete set null,
  state               text        not null default 'auto'
                                  check (state in ('auto', 'quiet', 'needs_amelia')),
  quiet_until         timestamptz,
  handoff_reason      text,
  last_member_msg_at  timestamptz,
  last_agent_reply_at timestamptz,
  updated_at          timestamptz not null default now()
);
create index if not exists support_chats_state_idx on public.support_chats (state, updated_at desc);

create table if not exists public.support_events (
  id              bigint generated always as identity primary key,
  contact_id      text        not null,
  kind            text        not null
                  check (kind in ('incoming', 'reply', 'handoff', 'skip', 'error', 'amelia_reply')),
  dedupe_key      text        unique,
  member_text     text,
  topic           text,
  confidence      numeric(3,2),
  reply_text      text,
  skip_reason     text,
  guard_failures  jsonb,
  model           text,
  latency_ms      integer,
  created_at      timestamptz not null default now()
);
create index if not exists support_events_contact_idx on public.support_events (contact_id, created_at desc);
create index if not exists support_events_created_idx on public.support_events (created_at desc);

alter table public.support_settings enable row level security;
alter table public.support_chats    enable row level security;
alter table public.support_events   enable row level security;

revoke all on public.support_settings, public.support_chats, public.support_events from anon, authenticated;
grant select on public.support_settings, public.support_chats, public.support_events to authenticated;

drop policy if exists "support_settings_select_admin" on public.support_settings;
create policy "support_settings_select_admin" on public.support_settings
  for select to authenticated using ( public.is_admin() );
drop policy if exists "support_chats_select_admin" on public.support_chats;
create policy "support_chats_select_admin" on public.support_chats
  for select to authenticated using ( public.is_admin() );
drop policy if exists "support_events_select_admin" on public.support_events;
create policy "support_events_select_admin" on public.support_events
  for select to authenticated using ( public.is_admin() );

-- 90-day retention for the log (member message text lives here).
select cron.schedule(
  'support-events-purge',
  '30 0 * * *',
  $$delete from public.support_events where created_at < now() - interval '90 days'$$
);
