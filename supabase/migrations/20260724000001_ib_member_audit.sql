-- Member Audit: store per-account balance (from the Dupoin export) on the
-- allowlist so we can flag members whose Dupoin balance is below a threshold.
-- Octa/Elev8 has no balance column → stays null.

alter table public.ib_accounts add column if not exists balance numeric;

-- Tell the Dupoin parser which column holds the balance.
update public.ib_brokers
  set parse_config = parse_config || '{"balanceColumn":"Balance"}'::jsonb
  where id = 'dupoin';
