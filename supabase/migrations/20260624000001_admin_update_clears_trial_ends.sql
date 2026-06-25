-- ============================================================================
-- fn_admin_update_member: clear trial_ends_at when an admin sets member_active.
-- Members have no trial clock (matches fn_verify_deposit + the data model).
-- Previously the member_active branch fell through to the `else`, keeping the
-- stale trial date — visible as a "TRIAL ENDS" value on members in /admin.
-- Only the trial_ends_at CASE changed; all other bookkeeping is identical.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_admin_update_member(
  target_user_id uuid,
  p_status text DEFAULT NULL::text,
  p_broker text DEFAULT NULL::text,
  p_trial_ends_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_trial_count integer DEFAULT NULL::integer
)
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
$function$
