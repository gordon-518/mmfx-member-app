-- ============================================================================
-- SEO attribution — the fifth cid family.
--
-- WHY. The /guides pages are the site's organic-search surface, and until now a
-- reader who arrived from Google and signed up was indistinguishable from a
-- direct visitor: nothing emitted an SEO cid, so `attr_cid`/`attr_last_cid` were
-- NULL for every one of them. The marketing site now writes `SEO-guide-<slug>`
-- into the `mmfx_attr` cookie on a guide view (see its lib/seoAttribution.ts —
-- the cookie is the only channel, because signup/actions.ts never reads the
-- signup URL's query string). That cid then flows through the two paths every
-- other family uses: fn_set_signup_attribution → profiles.attr_cid, and
-- fn_record_touch → attribution_touches → the attr_last_cid trigger.
--
-- fn_set_signup_attribution needs NO change: it accepts any cid trimmed to 120
-- characters and has no prefix allowlist. Two things do:
--
--   1. fn_record_touch buckets an unrecognised prefix as 'other', so SEO touches
--      would be recorded but indistinguishable from junk in attribution_touches.
--   2. organic_signups_by_cid filters ORG-% / EML-% / AGY-%, so the brain's
--      weekly report would silently drop every SEO row.
--
-- Precedence lives on the site, not here: a guide view only FILLS IN a missing
-- cid and never replaces one, so reading a guide after clicking an ad cannot
-- credit SEO with a purchased click.
--
-- Rollback dry run before applying (begin … rollback), as with the email and
-- partner migrations. Nothing here is destructive: both objects are replaced in
-- place, the constraint only widens, and no row is written or deleted.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- attribution_touches.source — widen to admit 'SEO'.
--
-- The constraint was created inline with the table, so Postgres named it
-- attribution_touches_source_check. ADD CONSTRAINT fails on a taken name, hence
-- the drop. This only ever widens the accepted set, so no existing row can
-- violate the new constraint and the ALTER needs no table rewrite of data.
-- ---------------------------------------------------------------------------
alter table public.attribution_touches
  drop constraint if exists attribution_touches_source_check;

alter table public.attribution_touches
  add constraint attribution_touches_source_check
  check (source in ('AGY', 'CRT', 'ORG', 'EML', 'SEO', 'other'));


-- ---------------------------------------------------------------------------
-- fn_record_touch — + the SEO branch.
--
-- Replaced whole rather than patched: it is the only writer of
-- attribution_touches and the rest of the body (the drop-not-raise guards, the
-- AGY- charset, the geo shape check) is unchanged and must stay exactly as it
-- was. The SEO branch sits last among the named families so the existing four
-- keep their precedence.
-- ---------------------------------------------------------------------------
create or replace function public.fn_record_touch(
  p_user_id uuid,
  p_cid     text,
  p_geo     text default null,
  p_path    text default null,
  p_anon_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cid  text := left(btrim(coalesce(p_cid, '')), 120);
  v_geo  text := upper(nullif(btrim(coalesce(p_geo, '')), ''));
  v_anon text := left(nullif(btrim(coalesce(p_anon_id, '')), ''), 64);
  v_path text := left(nullif(btrim(coalesce(p_path, '')), ''), 200);
  v_src  text;
begin
  if v_cid = '' then
    return;
  end if;

  -- The AGY- charset (§2.1): Meta substitutes an ad name into the template,
  -- so spaces and mixed case are expected. Anything outside it is not ours.
  -- SEO-guide-<slug> is a strict subset of this, so it needs no widening.
  if v_cid !~ '^[A-Za-z0-9._%~ -]{1,120}$' then
    return;
  end if;

  if p_user_id is null and v_anon is null then
    return;
  end if;

  if v_geo is not null and v_geo !~ '^[A-Z]{2}$' then
    v_geo := null;
  end if;

  v_src := case
    when v_cid like 'AGY-%' then 'AGY'
    when v_cid like 'CRT-%' then 'CRT'
    when v_cid like 'ORG-%' then 'ORG'
    when v_cid like 'EML-%' then 'EML'
    when v_cid like 'SEO-%' then 'SEO'
    else 'other'
  end;

  insert into public.attribution_touches (user_id, anon_id, cid, geo, source, path)
  values (p_user_id, v_anon, v_cid, v_geo, v_src, v_path);
end;
$$;

comment on function public.fn_record_touch(uuid, text, text, text, text) is
  'Record one attribution touch. Validates and DROPS bad input rather than raising — attribution must never break a signup. Sources: AGY/CRT/ORG/EML/SEO, else other. Service role only.';

revoke all on function public.fn_record_touch(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.fn_record_touch(uuid, text, text, text, text) to service_role;


-- ---------------------------------------------------------------------------
-- organic_signups_by_cid — + SEO-%.
--
-- Read by /api/organic/attribution, which passes the rows straight through to
-- the brain's weekly report. Adding the prefix here is the whole of the
-- reporting change: SEO signups and their verified deposits appear in the
-- weekly line with no new code path on either side.
--
-- Dropped and re-created (the body changes); the signature, the grants and the
-- name are unchanged.
-- ---------------------------------------------------------------------------
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
    and (attr_cid like 'ORG-%' or attr_cid like 'EML-%' or attr_cid like 'AGY-%'
         or attr_cid like 'SEO-%')
    and signup_at >= since
  group by attr_cid
$$;

revoke all on function public.organic_signups_by_cid(timestamptz) from public, anon, authenticated;
grant execute on function public.organic_signups_by_cid(timestamptz) to service_role;

comment on function public.organic_signups_by_cid(timestamptz) is
  'Signups and verified deposits per attribution cid (ORG-% organic social, EML-% lifecycle email, AGY-% ad partner, SEO-% guides) since a cutoff. Service role only; read by /api/organic/attribution.';
