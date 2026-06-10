-- ============================================================================
-- Add Elev8 as a partnered broker.
--
-- Two places know the broker list and BOTH must change together:
--   1. the profiles.broker CHECK constraint
--   2. the qualifying-deposit rule inside fn_verify_deposit
-- (This is the "adding a broker is a one-line ALTER" path promised in
-- SCHEMA.md — text + CHECK, no enum type rebuild.)
-- ============================================================================

alter table public.profiles
  drop constraint if exists profiles_broker_check;

alter table public.profiles
  add constraint profiles_broker_check check (
    broker in ('octa', 'dupoin', 'elev8')
  );

-- Recreate fn_verify_deposit with the expanded broker list. Identical to the
-- Day 4 version in every other respect.
create or replace function public.fn_verify_deposit(
  target_user_id uuid,
  p_broker       text,
  p_amount       numeric,
  p_ib_confirmed boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.profiles;
begin
  if not public.is_admin() then
    raise exception 'fn_verify_deposit: caller is not an admin';
  end if;

  if p_amount is null or p_amount < 500 then
    raise exception 'Deposit does not qualify: amount is below $500';
  end if;

  if p_broker is null or p_broker not in ('octa', 'dupoin', 'elev8') then
    raise exception 'Deposit does not qualify: broker must be a partnered broker (octa, dupoin or elev8)';
  end if;

  if p_ib_confirmed is not true then
    raise exception 'Deposit does not qualify: IB link attribution not confirmed';
  end if;

  select p.* into target
  from public.profiles p
  where p.id = target_user_id
  for update;

  if target.id is null then
    raise exception 'No profile found for user %', target_user_id;
  end if;

  if target.account_status = 'member_active' then
    raise exception 'User is already an active member — nothing to verify';
  end if;

  update public.profiles p
  set
    account_status      = 'member_active',
    member_status       = 'active',
    broker              = p_broker,
    deposit_amount      = p_amount,
    ib_link_confirmed   = true,
    deposit_verified_at = now(),
    deposit_verified_by = 'manual',
    downgraded_at       = null
  where p.id = target_user_id
  returning p.* into target;

  return target;
end;
$$;

comment on function public.fn_verify_deposit(uuid, text, numeric, boolean) is
  'Admin-only: record a verified qualifying deposit ($500+, partnered broker octa/dupoin/elev8, IB-confirmed) and flip the target to member_active. Rules enforced here, not in the UI.';

-- Re-assert privileges so this migration stands alone on a clean database
-- (create or replace preserves ACLs only when the function already exists).
revoke execute on function public.fn_verify_deposit(uuid, text, numeric, boolean) from public;
grant  execute on function public.fn_verify_deposit(uuid, text, numeric, boolean) to authenticated;
