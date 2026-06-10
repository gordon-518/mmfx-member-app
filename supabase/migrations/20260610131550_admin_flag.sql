-- ============================================================================
-- Day 4 · Task 1 — admin flag, is_admin() helper, admin read policy
--
--   - profiles.is_admin: boolean, default false. Nobody is made admin here;
--     that is a one-time manual UPDATE in the SQL Editor (see day4 brief).
--   - public.is_admin(): SECURITY DEFINER lookup of the CALLER's own row.
--     SECURITY DEFINER means it reads profiles as the function owner, which
--     bypasses RLS — required, because referencing profiles directly inside
--     a profiles policy would recurse into that same policy.
--   - profiles_select_admin: SELECT policy OR'd with Day 3's select-own —
--     admins can read every row; everyone else still sees only their own.
--
-- No write policies are added: admin writes happen via SECURITY DEFINER
-- functions (Tasks 2–3), never through direct table grants.
-- ============================================================================

alter table public.profiles
  add column is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Admin flag. Set manually in SQL, never from the app. Checked by public.is_admin(), which gates the admin read policy and the admin-only functions.';

-- ----------------------------------------------------------------------------
-- is_admin() — does the calling user's profile row carry is_admin = true?
-- STABLE: result cannot change within a statement, so the planner may cache
-- it per-statement instead of re-running it for every row the policy checks.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin
       from public.profiles p
      where p.id = (select auth.uid())),
    false
  );
$$;

comment on function public.is_admin() is
  'True iff the calling user (auth.uid()) has profiles.is_admin = true. SECURITY DEFINER so policies can call it without RLS recursion.';

revoke execute on function public.is_admin() from public;
grant  execute on function public.is_admin() to authenticated;

-- ----------------------------------------------------------------------------
-- Admin read access. Multiple permissive SELECT policies are OR'd, so this
-- extends (not replaces) profiles_select_own from Day 3.
-- ----------------------------------------------------------------------------
create policy "profiles_select_admin"
  on public.profiles
  for select
  to authenticated
  using ( public.is_admin() );
