-- ============================================================================
-- Day 4 · Task 3 — fn_grant_retrial (admin-only, eligibility-enforced)
--
-- Grants the ONE allowed re-trial. Eligibility is policy, enforced here with
-- NO override path — an admin cannot bypass it:
--   target is trial_expired
--   AND now() - downgraded_at >= 60 days
--   AND trial_count < 2
-- re_trial_expired is terminal; it never matches the trial_expired check.
-- ============================================================================

create or replace function public.fn_grant_retrial(
  target_user_id uuid
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

  -- Null-safe dormancy check: a missing downgraded_at can never qualify.
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
$$;

comment on function public.fn_grant_retrial(uuid) is
  'Admin-only: grant the single allowed re-trial to a trial_expired user dormant 60+ days with trial_count < 2. No override path — eligibility is enforced unconditionally.';

revoke execute on function public.fn_grant_retrial(uuid) from public;
grant  execute on function public.fn_grant_retrial(uuid) to authenticated;
