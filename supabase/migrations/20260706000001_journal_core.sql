-- ============================================================================
-- AI Trading Journal — Phase 1 core schema.
--
-- Five tables + the sync-job queue. Design:
--   docs/superpowers/specs/2026-07-06-ai-trading-journal-design.md
--
-- Source-agnostic: journal_deals/journal_trades know nothing about MetaApi.
-- RLS: users read (and where noted, write) their OWN rows; the sync worker
-- writes with the service role (server-only, never a browser).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- journal_accounts — one row per connected MT5 account.
-- The investor password is NEVER stored; we keep only the MetaApi account id.
-- ----------------------------------------------------------------------------
create table if not exists public.journal_accounts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  label               text,
  mt5_login           text not null,
  broker_server       text not null,
  metaapi_account_id  text unique,
  state               text not null default 'connecting'
                        check (state in ('connecting','deployed','failed','disconnected')),
  state_detail        text,
  balance             numeric,
  equity              numeric,
  currency            text,
  sync_cursor         timestamptz,
  last_synced_at      timestamptz,
  sync_error          text,
  created_at          timestamptz not null default now(),
  disconnected_at     timestamptz,
  unique (user_id, mt5_login, broker_server)
);

comment on table public.journal_accounts is
  'Connected MT5 accounts for the AI Trading Journal. Credentials are pass-through to MetaApi and never stored — only the MetaApi account id.';

alter table public.journal_accounts enable row level security;

create policy "journal_accounts_select_own"
  on public.journal_accounts for select
  to authenticated
  using (user_id = auth.uid());

create policy "journal_accounts_insert_own"
  on public.journal_accounts for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "journal_accounts_update_own"
  on public.journal_accounts for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- journal_deals — raw MT5 deals, append-only source of truth.
-- Written only by the sync worker (service role). Users may read their own
-- (via the owning account) for future drill-downs.
-- ----------------------------------------------------------------------------
create table if not exists public.journal_deals (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references public.journal_accounts(id) on delete cascade,
  deal_id      text not null,
  position_id  text,
  order_id     text,
  symbol       text,
  type         text not null,
  entry_type   text,
  volume       numeric,
  price        numeric,
  profit       numeric not null default 0,
  commission   numeric not null default 0,
  swap         numeric not null default 0,
  time         timestamptz not null,
  broker_time  text,
  magic        bigint,
  comment      text,
  unique (account_id, deal_id)
);

create index if not exists journal_deals_account_position_idx
  on public.journal_deals (account_id, position_id);
create index if not exists journal_deals_account_time_idx
  on public.journal_deals (account_id, time);

alter table public.journal_deals enable row level security;

create policy "journal_deals_select_own"
  on public.journal_deals for select
  to authenticated
  using (exists (
    select 1 from public.journal_accounts a
    where a.id = account_id and a.user_id = auth.uid()
  ));

-- ----------------------------------------------------------------------------
-- journal_trades — reconstructed round-trip trades (what the UI and AI read).
-- Rebuilt idempotently from deals; user may edit note/tags/emotion (Phase 2).
-- ----------------------------------------------------------------------------
create table if not exists public.journal_trades (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references public.journal_accounts(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  position_id  text not null,
  symbol       text not null,
  direction    text not null check (direction in ('buy','sell')),
  status       text not null check (status in ('open','closed')),
  volume       numeric not null,
  open_price   numeric,
  close_price  numeric,
  open_time    timestamptz,
  close_time   timestamptz,
  profit       numeric not null default 0,
  commission   numeric not null default 0,
  swap         numeric not null default 0,
  net_profit   numeric not null default 0,
  duration_sec integer,
  note         text,
  tags         text[],
  emotion      text,
  unique (account_id, position_id)
);

create index if not exists journal_trades_user_close_idx
  on public.journal_trades (user_id, close_time desc);
create index if not exists journal_trades_account_status_idx
  on public.journal_trades (account_id, status);

alter table public.journal_trades enable row level security;

create policy "journal_trades_select_own"
  on public.journal_trades for select
  to authenticated
  using (user_id = auth.uid());

-- Phase 2: notes/tags/emotion edits. Column-level: only these are granted.
create policy "journal_trades_update_own"
  on public.journal_trades for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke update on public.journal_trades from authenticated;
grant update (note, tags, emotion) on public.journal_trades to authenticated;

-- ----------------------------------------------------------------------------
-- journal_cash_flows — deposits/withdrawals (DEAL_TYPE_BALANCE deals).
-- Needed for correct equity-curve / drawdown math in Phase 2.
-- ----------------------------------------------------------------------------
create table if not exists public.journal_cash_flows (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.journal_accounts(id) on delete cascade,
  deal_id     text not null,
  amount      numeric not null,
  time        timestamptz not null,
  comment     text,
  unique (account_id, deal_id)
);

alter table public.journal_cash_flows enable row level security;

create policy "journal_cash_flows_select_own"
  on public.journal_cash_flows for select
  to authenticated
  using (exists (
    select 1 from public.journal_accounts a
    where a.id = account_id and a.user_id = auth.uid()
  ));

-- ----------------------------------------------------------------------------
-- journal_goals — the AI's benchmark. One row per user, user-editable.
-- ----------------------------------------------------------------------------
create table if not exists public.journal_goals (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  style               text check (style in ('scalper','day','swing','position')),
  account_size        numeric,
  monthly_target_pct  numeric,
  max_drawdown_pct    numeric,
  risk_per_trade_pct  numeric,
  instruments         text[],
  focus_text          text,
  updated_at          timestamptz not null default now()
);

alter table public.journal_goals enable row level security;

create policy "journal_goals_all_own"
  on public.journal_goals for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- journal_sync_jobs — the queue that protects the slow MetaApi fetch stage.
-- Service-role only; users never touch it.
-- ----------------------------------------------------------------------------
create table if not exists public.journal_sync_jobs (
  id            bigint generated always as identity primary key,
  account_id    uuid not null references public.journal_accounts(id) on delete cascade,
  status        text not null default 'queued'
                  check (status in ('queued','running','done','failed')),
  attempts      integer not null default 0,
  scheduled_at  timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz,
  error         text
);

create index if not exists journal_sync_jobs_queued_idx
  on public.journal_sync_jobs (status, scheduled_at)
  where status = 'queued';
create index if not exists journal_sync_jobs_account_idx
  on public.journal_sync_jobs (account_id, id desc);

alter table public.journal_sync_jobs enable row level security;
revoke all on public.journal_sync_jobs from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Queue functions. SECURITY DEFINER with a pinned search_path; EXECUTE is
-- revoked from app roles — only the service role (worker) calls them.
-- ----------------------------------------------------------------------------

-- Enqueue a sync job for every deployed account whose last sync is older than
-- p_stale and that has no queued/running job already (no pile-up).
create or replace function public.fn_enqueue_due_sync_jobs(p_stale interval)
returns integer
language sql
security definer
set search_path = public
as $$
  with due as (
    insert into public.journal_sync_jobs (account_id)
    select a.id
    from public.journal_accounts a
    where a.state = 'deployed'
      and (a.last_synced_at is null or a.last_synced_at < now() - p_stale)
      and not exists (
        select 1 from public.journal_sync_jobs j
        where j.account_id = a.id and j.status in ('queued','running')
      )
    returning 1
  )
  select coalesce(count(*), 0)::integer from due;
$$;

-- Claim up to p_limit due jobs. FOR UPDATE SKIP LOCKED makes concurrent
-- worker invocations safe — no job is ever claimed twice.
create or replace function public.fn_claim_sync_jobs(p_limit integer)
returns setof public.journal_sync_jobs
language sql
security definer
set search_path = public
as $$
  update public.journal_sync_jobs j
  set status = 'running', started_at = now()
  where j.id in (
    select id from public.journal_sync_jobs
    where status = 'queued' and scheduled_at <= now()
    order by scheduled_at
    for update skip locked
    limit p_limit
  )
  returning j.*;
$$;

revoke execute on function public.fn_enqueue_due_sync_jobs(interval) from public, anon, authenticated;
revoke execute on function public.fn_claim_sync_jobs(integer) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Scheduler — pg_cron + pg_net POST the worker route every 15 minutes (same
-- convention as daily-stats; consumes no Vercel Hobby cron slot).
--
-- RUN ONCE IN THE SUPABASE SQL EDITOR (replace the two placeholders):
--
--   select cron.schedule(
--     'journal-sync',
--     '*/15 * * * *',
--     $$
--       select net.http_post(
--         url     := 'https://APP_URL/api/journal/cron/sync',
--         headers := jsonb_build_object(
--           'Content-Type',  'application/json',
--           'Authorization', 'Bearer JOURNAL_CRON_SECRET_VALUE'
--         ),
--         body    := '{}'::jsonb
--       );
--     $$
--   );
--
-- Verify:    select jobname, schedule, active from cron.job;
-- Unschedule: select cron.unschedule('journal-sync');
-- ----------------------------------------------------------------------------
