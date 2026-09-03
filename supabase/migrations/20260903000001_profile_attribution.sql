-- ============================================================================
-- Signup attribution — persist the cid/geo/feature that signup/actions.ts already
-- reads from the mmfx_attr cookie and, until now, only handed to Meta CAPI before
-- discarding. Without these columns there is no way to count signups per campaign,
-- which makes signup-ranked optimisation (paid or organic) impossible.
--
-- Columns are nullable: organic/direct signups legitimately have no cid.
-- ============================================================================

alter table public.profiles
  add column if not exists attr_cid     text,
  add column if not exists attr_geo     text,
  add column if not exists attr_feature text;

comment on column public.profiles.attr_cid is
  'Tracking id from the ad/post that produced this signup (CRT-* paid, ORG-* organic). Null for direct.';

create index if not exists profiles_attr_cid_idx
  on public.profiles (attr_cid)
  where attr_cid is not null;

-- Counting signups per cid is the one query the marketing brain needs. It is
-- security definer so the API route can call it with the service role without
-- exposing the profiles table itself.
create or replace function public.organic_signups_by_cid(since timestamptz)
returns table (cid text, signups bigint)
language sql
security definer
set search_path = public
as $$
  select attr_cid as cid, count(*) as signups
  from public.profiles
  where attr_cid is not null
    and attr_cid like 'ORG-%'
    and signup_at >= since
  group by attr_cid
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default, and anon/authenticated
-- INHERIT that grant — so revoking from those two roles alone leaves the function callable
-- with the public anon key. Since it is security definer over profiles, that would be an RLS
-- bypass. Revoke from PUBLIC first, then grant explicitly to the one role that needs it.
revoke all on function public.organic_signups_by_cid(timestamptz) from public, anon, authenticated;
grant execute on function public.organic_signups_by_cid(timestamptz) to service_role;
