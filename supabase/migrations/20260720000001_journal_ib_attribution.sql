-- IB attribution: broker registry + per-IB account allowlist + review state.
-- Admin/service-role only. Traders never read/write these; all access is via
-- requireAdminApi-guarded routes using the service role.

create table if not exists public.ib_brokers (
  id text primary key,
  display_name text not null,
  enforcement_mode text not null default 'strict'
    check (enforcement_mode in ('strict', 'monitor')),
  parse_config jsonb not null default '{}'::jsonb,
  allowlist_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ib_accounts (
  broker_id text not null references public.ib_brokers(id) on delete cascade,
  mt5_login text not null,
  imported_at timestamptz not null default now(),
  primary key (broker_id, mt5_login)
);
create index if not exists ib_accounts_login_idx on public.ib_accounts (mt5_login);

alter table public.journal_accounts
  add column if not exists broker_id text references public.ib_brokers(id),
  add column if not exists ib_review text not null default 'ok'
    check (ib_review in ('ok', 'flagged', 'journal_blocked'));

-- Seed the two brokers. parse_config drives the pure parser:
--   column: which export column holds the account id(s)
--   strip:  prefixes removed in order to reach the numeric MT5 login
--   split:  whether the cell holds multiple comma-separated accounts
insert into public.ib_brokers (id, display_name, enforcement_mode, parse_config) values
  ('dupoin', 'Dupoin', 'strict',
    '{"sheet":"ReferAccountListExcel","column":"Account","strip":[],"split":false}'::jsonb),
  ('elev8_octa', 'Elev8 / Octa', 'strict',
    '{"sheet":"Sheet1","column":"trading_account","strip":["Octa_","TA"],"split":true}'::jsonb)
on conflict (id) do nothing;

-- RLS: enable, add NO permissive policies. Deny-all to anon/authenticated;
-- the service role bypasses RLS, and every access path is a service-role query
-- inside a requireAdminApi-guarded route.
alter table public.ib_brokers enable row level security;
alter table public.ib_accounts enable row level security;
