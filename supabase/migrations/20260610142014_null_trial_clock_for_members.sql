-- ============================================================================
-- Members carry no trial clock: trial_ends_at becomes NULL on the flip to
-- member_active (Gordon, 2026-06-10 — "trial ends should become nil to avoid
-- confusion later down the line").
--
--   - trial_ends_at is now nullable, BUT a new CHECK guarantees active-trial
--     states always have a clock (the lazy-expiry and access guard depend
--     on it).
--   - fn_verify_deposit and fn_admin_update_member null the clock when
--     setting member_active; reactivating a trial from a null/lapsed clock
--     restarts it at +14 days.
--   - Existing member rows are backfilled to null.
--   - Expired states keep their historical trial_ends_at.
-- ============================================================================

alter table public.profiles
  alter column trial_ends_at drop not null;

alter table public.profiles
  add constraint profiles_trial_clock_check check (
    account_status not in ('trial_active', 're_trial_active')
    or trial_ends_at is not null
  );

update public.profiles
set trial_ends_at = null
where account_status = 'member_active';

-- ----------------------------------------------------------------------------
-- fn_verify_deposit: same as before + trial_ends_at = null on the member flip.
-- ----------------------------------------------------------------------------
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
    downgraded_at       = null,
    trial_ends_at       = null
  where p.id = target_user_id
  returning p.* into target;

  return target;
end;
$$;

revoke execute on function public.fn_verify_deposit(uuid, text, numeric, boolean) from public, anon;
grant  execute on function public.fn_verify_deposit(uuid, text, numeric, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- fn_admin_update_member: member_active nulls the clock; reactivating a trial
-- from a null OR lapsed clock restarts it at +14 days.
-- ----------------------------------------------------------------------------
create or replace function public.fn_admin_update_member(
  target_user_id  uuid,
  p_status        text default null,
  p_broker        text default null,
  p_trial_ends_at timestamptz default null,
  p_trial_count   integer default null
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
    raise exception 'fn_admin_update_member: caller is not an admin';
  end if;

  if p_status is not null and p_status not in
     ('trial_active','trial_expired','member_active','re_trial_active','re_trial_expired') then
    raise exception 'Invalid status %', p_status;
  end if;

  if p_broker is not null and p_broker not in ('octa','dupoin','elev8') then
    raise exception 'Invalid broker % (octa, dupoin or elev8)', p_broker;
  end if;

  if p_trial_count is not null and (p_trial_count < 1 or p_trial_count > 2) then
    raise exception 'Invalid trial count % (must be 1 or 2)', p_trial_count;
  end if;

  select p.* into target
  from public.profiles p
  where p.id = target_user_id
  for update;

  if target.id is null then
    raise exception 'No profile found for user %', target_user_id;
  end if;

  update public.profiles p
  set
    broker         = coalesce(p_broker, p.broker),
    trial_count    = coalesce(p_trial_count, p.trial_count),
    account_status = coalesce(p_status, p.account_status),

    member_status = case
      when p_status = 'member_active' then 'active'
      when p_status is not null       then 'inactive'
      else p.member_status
    end,
    downgraded_at = case
      when p_status in ('member_active','trial_active','re_trial_active') then null
      when p_status in ('trial_expired','re_trial_expired') then coalesce(p.downgraded_at, now())
      else p.downgraded_at
    end,
    trial_ends_at = case
      -- members carry no trial clock
      when p_status = 'member_active' then null
      -- (re)activating a trial with no usable clock restarts it
      when p_status in ('trial_active','re_trial_active')
           and p_trial_ends_at is null
           and (p.trial_ends_at is null or p.trial_ends_at <= now())
        then now() + interval '14 days'
      else coalesce(p_trial_ends_at, p.trial_ends_at)
    end
  where p.id = target_user_id
  returning p.* into target;

  return target;
end;
$$;

revoke execute on function public.fn_admin_update_member(uuid, text, text, timestamptz, integer) from public, anon;
grant  execute on function public.fn_admin_update_member(uuid, text, text, timestamptz, integer) to authenticated;
