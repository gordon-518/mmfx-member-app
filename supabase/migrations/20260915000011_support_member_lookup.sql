-- Support agent: resolve a deposit reference code (MM-XXXXXX = first 6 hex chars
-- of profiles.id) to a user id. Returns NULL unless exactly one profile matches.
-- Service role only: the agent route calls it; members and anon can't.
create or replace function public.fn_support_member_by_ref(p_hex text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case when count(*) = 1 then min(id::text)::uuid end
    from public.profiles
   where p_hex ~ '^[0-9a-fA-F]{6}$'
     and replace(id::text, '-', '') like lower(p_hex) || '%';
$$;

revoke all on function public.fn_support_member_by_ref(text) from public, anon, authenticated;
grant execute on function public.fn_support_member_by_ref(text) to service_role;
