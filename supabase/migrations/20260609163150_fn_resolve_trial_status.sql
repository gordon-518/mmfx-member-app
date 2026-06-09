-- ============================================================================
-- Day 3 · Task 4 — lazy-expiry function
-- fn_resolve_trial_status() resolves the CALLING user's trial state on read.
--
-- For auth.uid()'s own row, if it is an active trial past its clock:
--   trial_active     + now() > trial_ends_at -> trial_expired
--   re_trial_active  + now() > trial_ends_at -> re_trial_expired
--   ...and stamp downgraded_at = now() (re-trial eligibility depends on this).
-- Otherwise it changes nothing. Always returns the (possibly updated) row.
--
-- SECURITY DEFINER so it can write through RLS, but it is HARD-SCOPED to the
-- caller's own row (where id = auth.uid()) — it can never touch another row.
-- search_path pinned to '' with every object fully qualified.
-- ============================================================================

create or replace function public.fn_resolve_trial_status()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid    uuid := (select auth.uid());
  result public.profiles;
begin
  if uid is null then
    raise exception 'fn_resolve_trial_status: no authenticated user';
  end if;

  -- Flip an expired active trial. WHERE guarantees we only ever touch the
  -- caller's own row, and only when it is genuinely a lapsed active trial.
  update public.profiles p
  set
    account_status = case p.account_status
      when 'trial_active'    then 'trial_expired'
      when 're_trial_active' then 're_trial_expired'
      else p.account_status
    end,
    downgraded_at = now()
  where p.id = uid
    and p.account_status in ('trial_active', 're_trial_active')
    and now() > p.trial_ends_at
  returning p.* into result;

  -- No flip happened (not due, or not in an active-trial state): return as-is.
  if result.id is null then
    select p.* into result
    from public.profiles p
    where p.id = uid;
  end if;

  return result;
end;
$$;

comment on function public.fn_resolve_trial_status() is
  'Lazy trial expiry for the calling user (auth.uid()): flips trial_active->trial_expired / re_trial_active->re_trial_expired when now() > trial_ends_at and stamps downgraded_at. Own row only. Returns the current profile row.';

-- Only authenticated users may call it; deny the PUBLIC default grant.
revoke execute on function public.fn_resolve_trial_status() from public;
grant  execute on function public.fn_resolve_trial_status() to authenticated;
