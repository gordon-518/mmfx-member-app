-- ============================================================================
-- Conversion-fix 2.1a — trial back to 14 days, for NEW trials only.
--
-- Re-creates the three functions that mint a trial clock. Each body is the LIVE
-- definition (pg_get_functiondef, 10 Sep 2026) with exactly one change:
-- interval '7 days' -> interval '14 days'. Nothing else differs; in particular
-- handle_new_user keeps signup_fingerprint (re-created 24 Aug), and
-- fn_grant_retrial's 60-day dormancy rule is untouched.
--
-- No backfill: trials already running keep their 7-day trial_ends_at.
-- create or replace preserves each function's existing grants.
-- ============================================================================

-- ─── handle_new_user (signup trigger: first trial) ───

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.profiles (
    id, email, full_name, country, signup_fingerprint,
    signup_at, trial_ends_at, trial_count, account_status, member_status
  )
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(upper(trim(new.raw_user_meta_data ->> 'country')), ''),
    nullif(trim(new.raw_user_meta_data ->> 'fingerprint'), ''),
    now(),
    now() + interval '14 days',
    1,
    'trial_active',
    'inactive'
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

-- ─── fn_grant_retrial (admin re-trial) ───

CREATE OR REPLACE FUNCTION public.fn_grant_retrial(target_user_id uuid)
 RETURNS profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    trial_ends_at  = now() + interval '14 days',
    downgraded_at  = null
  where p.id = target_user_id
  returning p.* into target;

  return target;
end;
$function$;

-- ─── fn_admin_update_member (admin reactivation of a lapsed trial) ───

CREATE OR REPLACE FUNCTION public.fn_admin_update_member(target_user_id uuid, p_status text DEFAULT NULL::text, p_broker text DEFAULT NULL::text, p_trial_ends_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_trial_count integer DEFAULT NULL::integer)
 RETURNS profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        then now() + interval '14 days'
      else coalesce(p_trial_ends_at, p.trial_ends_at)
    end
  where p.id = target_user_id
  returning p.* into target;

  return target;
end;
$function$;
