-- ============================================================================
-- Review hardening for the ebook storage gate:
--   is_full_access(): make the null-clock guard EXPLICIT. The prior version
--   relied on now() < NULL -> NULL -> coalesce(..., false) closing correctly
--   by coincidence. Adding `trial_ends_at is not null` mirrors the Day-5
--   accessTier guard literally and removes the NULL ambiguity. Behaviour is
--   unchanged (the trial-clock CHECK already forbids active trials with a
--   null clock), but the intent is now obvious to an auditor.
--
-- (RLS on storage.objects is already enabled by Supabase's managed default —
-- a migration can't `alter table` it anyway, since it's owned by
-- supabase_storage_admin, not postgres. The active policy + Limited-denied
-- behaviour confirm RLS is on.)
-- ============================================================================

create or replace function public.is_full_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select
        p.account_status = 'member_active'
        or (
          p.account_status in ('trial_active', 're_trial_active')
          and p.trial_ends_at is not null
          and now() < p.trial_ends_at
        )
      from public.profiles p
      where p.id = (select auth.uid())
    ),
    false
  );
$$;

revoke execute on function public.is_full_access() from public, anon;
grant  execute on function public.is_full_access() to authenticated;
