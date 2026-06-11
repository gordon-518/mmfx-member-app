-- ============================================================================
-- Least-privilege: strip anon from the content tables.
--
-- Supabase's default privileges granted anon full table access on the new
-- daily_analysis / live_classes tables (revoke-from-public doesn't strip the
-- role-specific anon grant — the standing gotcha). RLS already denies anon
-- every row (policies are `to authenticated` only), but anon should have no
-- table privilege at all. Same cleanup as the Day-4 least_privilege migration.
-- ============================================================================

revoke all on table public.daily_analysis from anon;
revoke all on table public.live_classes from anon;
