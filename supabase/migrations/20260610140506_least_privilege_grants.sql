-- ============================================================================
-- Least-privilege cleanup (from live ACL audit).
--
-- Supabase's ALTER DEFAULT PRIVILEGES hands anon/authenticated EXECUTE on
-- every new function as ROLE-SPECIFIC grants, so "revoke ... from public"
-- alone does not strip anon. Likewise the profiles table carried the legacy
-- broad table grants (insert/update/delete/truncate for anon+authenticated).
-- None of it was exploitable — RLS leaves anon with zero rows, write RLS has
-- no policies, and TRUNCATE isn't reachable via PostgREST — but the surface
-- should match intent:
--   anon           -> nothing at all
--   authenticated  -> SELECT on profiles (RLS-rowed) + the four RPCs
--   writes         -> only via SECURITY DEFINER functions (owner: postgres)
--
-- NOTE for future migrations: any new function gets anon EXECUTE by default;
-- revoke it explicitly, as below.
-- ============================================================================

-- Functions: anon can call nothing.
revoke execute on function public.is_admin() from anon;
revoke execute on function public.fn_resolve_trial_status() from anon;
revoke execute on function public.fn_verify_deposit(uuid, text, numeric, boolean) from anon;
revoke execute on function public.fn_grant_retrial(uuid) from anon;

-- Trigger functions: not invocable via RPC by design, but strip every
-- API-facing role for hygiene.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- profiles table: anon gets nothing; authenticated keeps SELECT only.
revoke all on table public.profiles from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.profiles from authenticated;
