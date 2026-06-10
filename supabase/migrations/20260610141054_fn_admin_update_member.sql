-- ============================================================================
-- fn_admin_update_member — the manual override editor behind the admin
-- dashboard, making it the single source of truth for member state.
--
-- DELIBERATE POLICY CHANGE (Gordon, 2026-06-10): unlike fn_verify_deposit and
-- fn_grant_retrial (which keep enforcing the strict business rules for the
-- normal flows), this function lets an admin set ANY valid state directly —
-- including member_active without a deposit and re_trial_active outside the
-- 60-day window. It exists so routine corrections never require the SQL
-- Editor. It still:
--   - requires an admin caller (is_admin())
--   - only accepts values the CHECK constraints allow
--   - keeps the bookkeeping fields consistent for every status it sets
--
-- Only non-null parameters are applied; null means "leave unchanged".
-- ============================================================================

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

    -- Bookkeeping invariants follow the status being set:
    --   member_active        -> member_status active,  downgraded_at cleared
    --   *_expired            -> member_status inactive, downgraded_at stamped
    --                           (kept if already set)
    --   trial/re_trial_active-> member_status inactive, downgraded_at cleared,
    --                           and a lapsed clock restarts at +14 days unless
    --                           an explicit trial_ends_at was supplied
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
$$;

comment on function public.fn_admin_update_member(uuid, text, text, timestamptz, integer) is
  'Admin manual override: set status/broker/trial fields directly from the dashboard. Validates values and keeps member_status/downgraded_at/trial_ends_at consistent, but does NOT enforce the deposit or re-trial business rules — fn_verify_deposit / fn_grant_retrial remain the rule-enforced paths.';

revoke execute on function public.fn_admin_update_member(uuid, text, text, timestamptz, integer) from public, anon;
grant  execute on function public.fn_admin_update_member(uuid, text, text, timestamptz, integer) to authenticated;
