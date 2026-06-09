-- ============================================================================
-- Day 3 · Task 3 — Row Level Security on profiles
-- A user can read ONLY their own row. No user write policies today.
--
--   SELECT : authenticated, auth.uid() = id  (own row only)
--   INSERT : none  -> seeded by handle_new_user (SECURITY DEFINER, Task 2)
--   UPDATE : none  -> status changes by fn_resolve_trial_status (Task 4)
--   DELETE : none
--
-- With RLS enabled and no INSERT/UPDATE/DELETE policies, ALL user writes are
-- denied by default. The SECURITY DEFINER functions run as the table owner and
-- bypass RLS, so signup-seeding and lazy-expiry still work.
-- The anon role gets no policy here, so it can read nothing.
-- ============================================================================

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ( (select auth.uid()) = id );
