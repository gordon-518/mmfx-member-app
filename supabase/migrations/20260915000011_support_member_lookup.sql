-- Support agent: resolve a deposit reference code (MM-XXXXXX = first 6 hex chars
-- of profiles.id) to a user id. Returns NULL unless exactly one profile matches.
-- Service role only: the agent route calls it; members and anon can't.
--
-- Collision arithmetic: 6 hex chars = 16,777,216 buckets. At ~3,000 members
-- that's roughly a 1-in-4 chance that SOME pair of members already shares a
-- reference prefix (birthday bound: 1 - exp(-n^2/(2*16777216)) at n=3000).
-- The `count(*) = 1` gate below makes such a code resolve to nobody rather
-- than to the wrong somebody — the safe outcome, but a silent one. Detect
-- existing collisions with:
--   select left(replace(id::text,'-',''),6) h, count(*) from public.profiles group by 1 having count(*) > 1;
create or replace function public.fn_support_member_by_ref(p_hex text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when count(*) = 1 then min(id::text)::uuid end
    from public.profiles
   where p_hex ~ '^[0-9a-fA-F]{6}$'
     and replace(id::text, '-', '') like lower(p_hex) || '%';
$$;

revoke all on function public.fn_support_member_by_ref(text) from public, anon, authenticated;
grant execute on function public.fn_support_member_by_ref(text) to service_role;
