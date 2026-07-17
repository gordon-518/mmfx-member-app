-- Reduce the free trial from 14 days to 7 days, for FUTURE signups + re-trials.
-- Existing trial users keep their already-set trial_ends_at (untouched). Only the
-- three functions that MINT a trial clock change: signup trigger, re-trial grant,
-- and the admin lapsed-clock restart. Bodies are verbatim from the live
-- definitions — only interval '14 days' → '7 days'.

-- 1. Signup trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (
    id, email, full_name, country,
    signup_at, trial_ends_at, trial_count, account_status, member_status
  )
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(upper(trim(new.raw_user_meta_data ->> 'country')), ''),
    now(),
    now() + interval '7 days',
    1,
    'trial_active',
    'inactive'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Seeds public.profiles for each new auth user: trial_active, 7-day clock, full_name + country from raw_user_meta_data. SECURITY DEFINER, search_path pinned.';

-- 2. Re-trial grant (admin) — a re-trial is a fresh trial, kept consistent at 7d.
create or replace function public.fn_grant_retrial(target_user_id uuid)
returns profiles language plpgsql security definer set search_path = '' as $$
declare
  target public.profiles;
begin
  if not public.is_admin() then
    raise exception 'fn_grant_retrial: caller is not an admin';
  end if;

  select p.* into target
  from public.profiles p
  where p.id = target_user_id
  for update;

  if target.id is null then
    raise exception 'No profile found for user %', target_user_id;
  end if;

  if target.account_status <> 'trial_expired' then
    raise exception 'Re-trial not allowed: user is % (only trial_expired users can be granted a re-trial)',
      target.account_status;
  end if;

  if target.trial_count >= 2 then
    raise exception 'Re-trial not allowed: lifetime trial cap reached (trial_count = %)', target.trial_count;
  end if;

  if target.downgraded_at is null
     or now() - target.downgraded_at < interval '60 days' then
    raise exception 'Re-trial not allowed: user must be dormant for 60+ days after downgrade';
  end if;

  update public.profiles p
  set
    account_status = 're_trial_active',
    trial_count    = 2,
    trial_ends_at  = now() + interval '7 days',
    downgraded_at  = null
  where p.id = target_user_id
  returning p.* into target;

  return target;
end;
$$;

-- 3. Admin member update — lapsed-clock restart uses 7 days.
create or replace function public.fn_admin_update_member(
  target_user_id uuid,
  p_status text default null,
  p_broker text default null,
  p_trial_ends_at timestamptz default null,
  p_trial_count integer default null
)
returns profiles language plpgsql security definer set search_path = '' as $$
declare
  target public.profiles;
begin
  if not public.is_admin() then
    raise exception 'fn_admin_update_member: caller is not an admin';
  end if;

  if p_status is not null and p_status not in
     ('trial_active','trial_expired','member_active',
      're_trial_active','re_trial_expired','member_expired') then
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
      when p_status = 'member_active'  then 'active'
      when p_status is not null        then 'inactive'
      else p.member_status
    end,
    downgraded_at = case
      when p_status in ('member_active','trial_active','re_trial_active') then null
      when p_status in ('trial_expired','re_trial_expired','member_expired')
        then coalesce(p.downgraded_at, now())
      else p.downgraded_at
    end,
    trial_ends_at = case
      when p_status = 'member_active' then null
      when p_status in ('trial_active','re_trial_active')
           and p_trial_ends_at is null
           and p.trial_ends_at <= now()
        then now() + interval '7 days'
      else coalesce(p_trial_ends_at, p.trial_ends_at)
    end
  where p.id = target_user_id
  returning p.* into target;

  return target;
end;
$$;
