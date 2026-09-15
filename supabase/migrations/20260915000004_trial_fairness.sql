-- ============================================================================
-- Trial fairness (Gordon, 15 Sep): a trial user who deposits early keeps full
-- trial access until the trial ends, then drops to the tier their cumulative
-- deposits reached.
--
-- fn_verify_deposit used to clear trial_ends_at on every verification, so a
-- $50 deposit on day 3 of a 14-day trial cut the full desk down to Foundation
-- straight away. Re-created from its current body (20260910000006, with the
-- double-submit guard) with ONE change: a still-running trial clock is kept.
-- profiles_trial_clock_check only requires a clock on trial states, so a
-- member_active row may carry one. The app reads it as "trial access until".
-- Signature and grants unchanged.
-- ============================================================================

create or replace function public.fn_verify_deposit(
  target_user_id uuid,
  p_broker text,
  p_amount numeric,
  p_ib_confirmed boolean
)
returns public.profiles
language plpgsql
security definer
set search_path to ''
as $function$
declare
  target public.profiles;
begin
  if not public.is_admin() then
    raise exception 'fn_verify_deposit: caller is not an admin';
  end if;

  -- changed (3.2): $50 is the lowest qualifying deposit (Foundation).
  if p_amount is null or p_amount < 50 then
    raise exception 'Deposit does not qualify: amount is below $50';
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

  -- changed (3.2): an existing member is no longer rejected. Verifying them
  -- again records a top-up.

  -- added (3.2 review): double-submit guard. Dropping the "already a member"
  -- rejection removed the only thing stopping a double-clicked Verify from
  -- recording the same deposit twice and inflating the tier. The FOR UPDATE
  -- above serialises concurrent verifies for this user, so a second submit
  -- waits, then sees the first one's ledger row here.
  if exists (
    select 1
    from public.deposit_events e
    where e.user_id = target_user_id
      and e.amount = p_amount
      and e.broker = p_broker
      and e.verified_at > now() - interval '2 minutes'
  ) then
    raise exception 'Looks like a duplicate: a $% % deposit for this user was verified in the last 2 minutes', p_amount, p_broker;
  end if;

  -- added (3.2): the ledger row. The running total below is derived from it.
  insert into public.deposit_events (user_id, amount, broker, ib_confirmed, verified_by, verified_at)
  values (target_user_id, p_amount, p_broker, true, (select auth.uid()), now());

  update public.profiles p
  set
    account_status      = 'member_active',
    member_status       = 'active',
    broker              = p_broker,
    -- changed (3.2): cumulative, never overwritten.
    deposit_amount      = coalesce(p.deposit_amount, 0) + p_amount,
    ib_link_confirmed   = true,
    -- changed (3.2): the first verification's time sticks; top-ups don't move it.
    deposit_verified_at = coalesce(p.deposit_verified_at, now()),
    deposit_verified_by = 'manual',
    downgraded_at       = null,
    -- changed (15 Sep, Gordon): a trial that's still running keeps its clock,
    -- so an early depositor keeps the trial's full access until it ends (the
    -- app's accessTierFor). An expired or absent clock is cleared as before.
    trial_ends_at       = case
                            when p.account_status in ('trial_active', 're_trial_active')
                                 and p.trial_ends_at > now()
                            then p.trial_ends_at
                            else null
                          end
  where p.id = target_user_id
  returning p.* into target;

  return target;
end;
$function$;
