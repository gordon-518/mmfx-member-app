-- ============================================================================
-- organic_signups_by_cid: see email, and count deposits (design doc §7).
--
-- Two blind spots, both in the same function:
--
--   1. It filters attr_cid like 'ORG-%', so every lifecycle email cid
--      (EML-<flow>-<step>) was invisible to the brain's weekly report. The
--      rail can tag every link perfectly and still measure nothing.
--   2. It counts signups only. "Emails sent · opened · signups by cid ·
--      deposits by cid" is the line §7 asks for, and the deposit half was
--      simply not available — deposit_verified_at is right there on the same
--      row.
--
-- Return shape widens from (cid, signups) to (cid, signups, deposits). The
-- caller, /api/organic/attribution, passes rows through untouched, so the new
-- column arrives without a code change; nothing reads the tuple positionally.
--
-- The name stays organic_signups_by_cid: renaming it would break the brain
-- mid-deploy for no gain, and "organic" was always the wrong half of the name
-- anyway — it is the attribution read.
--
-- Additive: replaces the body, keeps the signature and the grants.
-- ============================================================================

drop function if exists public.organic_signups_by_cid(timestamptz);

create or replace function public.organic_signups_by_cid(since timestamptz)
returns table (cid text, signups bigint, deposits bigint)
language sql
security definer
set search_path = public
as $$
  select attr_cid as cid,
         count(*) as signups,
         count(*) filter (where deposit_verified_at is not null) as deposits
  from public.profiles
  where attr_cid is not null
    and (attr_cid like 'ORG-%' or attr_cid like 'EML-%')
    and signup_at >= since
  group by attr_cid
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default, and
-- anon/authenticated INHERIT that grant. Since this is security definer over
-- profiles, leaving it would be an RLS bypass. Revoke from PUBLIC first, then
-- grant to the one role that needs it (as the original migration did).
revoke all on function public.organic_signups_by_cid(timestamptz) from public, anon, authenticated;
grant execute on function public.organic_signups_by_cid(timestamptz) to service_role;

comment on function public.organic_signups_by_cid(timestamptz) is
  'Signups and verified deposits per attribution cid (ORG-% organic, EML-% lifecycle email) since a cutoff. Service role only; read by /api/organic/attribution.';
