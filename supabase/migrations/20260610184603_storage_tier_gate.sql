-- ============================================================================
-- Day 7 · Task 1 — tier-gated storage access for the private `ebooks` bucket.
--
-- Ebooks live in a PRIVATE Supabase Storage bucket. Delivery is gated at the
-- STORAGE layer (not just the UI): a Limited user calling storage directly
-- still cannot read the objects. The gate is the same Full/Limited tier logic
-- as the Day-5 helper (accessTier), expressed in SQL with the time-check guard.
--
-- No service_role anywhere — the policy calls a SECURITY DEFINER function,
-- the same posture as is_admin() / is_full_access patterns on prior days.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- is_full_access() — Full tier for the CALLING user (auth.uid())?
--   member_active                              -> always Full
--   trial_active / re_trial_active             -> Full only while now < clock
--   everything else (incl. null clock, no row) -> not Full (fail closed)
-- Mirrors src/lib/trial/status.ts accessTier exactly.
--
-- SECURITY DEFINER so a storage policy can call it without the caller needing
-- read access to public.profiles, and without RLS recursion. STABLE so the
-- planner evaluates it once per statement.
-- ----------------------------------------------------------------------------
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
          and now() < p.trial_ends_at
        )
      from public.profiles p
      where p.id = (select auth.uid())
    ),
    false
  );
$$;

comment on function public.is_full_access() is
  'True iff the calling user currently has Full access: member_active, or an active trial/re-trial still within trial_ends_at. Mirrors the Day-5 accessTier time-check guard. SECURITY DEFINER for use in the ebooks storage policy.';

revoke execute on function public.is_full_access() from public, anon;
grant  execute on function public.is_full_access() to authenticated;

-- ----------------------------------------------------------------------------
-- Storage RLS: only Full-tier authenticated users may READ ebook objects.
-- No INSERT/UPDATE/DELETE policy — uploads are done by Gordon via the
-- dashboard (admin), never by app users. anon gets nothing.
-- ----------------------------------------------------------------------------
create policy "ebooks_full_access_read"
  on storage.objects
  for select
  to authenticated
  using ( bucket_id = 'ebooks' and public.is_full_access() );
