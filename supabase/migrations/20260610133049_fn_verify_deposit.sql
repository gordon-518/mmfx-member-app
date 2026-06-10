-- ============================================================================
-- Day 4 · Task 2 — fn_verify_deposit (admin-only, rule-enforced)
--
-- Marks a verified qualifying deposit on the target user and flips them to
-- member_active. The qualifying-deposit rule lives HERE, not in the UI:
--   amount >= 500  AND  broker in ('octa','dupoin')  AND  ib_confirmed = true
--
-- Caller must be an admin (public.is_admin()). Launch-mode verification is
-- manual, so deposit_verified_by is hard-set to 'manual'.
-- ============================================================================

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
  -- Privilege gate first: nothing happens for non-admins.
  if not public.is_admin() then
    raise exception 'fn_verify_deposit: caller is not an admin';
  end if;

  -- Qualifying-deposit rules. Null-safe: a NULL amount/broker must reject,
  -- not slip through an (unknown) comparison.
  if p_amount is null or p_amount < 500 then
    raise exception 'Deposit does not qualify: amount is below $500';
  end if;

  if p_broker is null or p_broker not in ('octa', 'dupoin') then
    raise exception 'Deposit does not qualify: broker must be a partnered broker (octa or dupoin)';
  end if;

  if p_ib_confirmed is not true then
    raise exception 'Deposit does not qualify: IB link attribution not confirmed';
  end if;

  -- Lock the target row so concurrent admin actions serialize.
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

  -- Qualifying deposit flips ANY non-member state to member_active. Clear
  -- downgraded_at: it belongs to the expired-trial life the user just left.
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
  'Admin-only: record a verified qualifying deposit ($500+, partnered broker, IB-confirmed) and flip the target to member_active. Rules enforced here, not in the UI.';

revoke execute on function public.fn_verify_deposit(uuid, text, numeric, boolean) from public;
grant  execute on function public.fn_verify_deposit(uuid, text, numeric, boolean) to authenticated;
