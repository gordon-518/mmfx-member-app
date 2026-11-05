-- ============================================================================
-- Sponsor dashboard — kind and brokers on partners, the sponsorship windows,
-- the SPN cid family, and the sponsor readers (design doc 2026-11-05).
--
-- A sponsor is a broker that pays for MMFX's ads in a country and wants to see
-- what it bought. It is a partner row of kind 'sponsor' with one or more
-- (country, since, until) windows. The headline is every signup from those
-- countries inside the windows; "directly traced" is the subset whose
-- first-touch cid is SPN-<slug>-<ad name>. Funding counts only against the
-- sponsor's own brokers: a sponsored signup who deposits elsewhere is invisible
-- to the sponsor (§1 of the design).
--
-- What ships here:
--
--   partners.kind, partners.brokers   'agency' (the default; Ren) or 'sponsor'.
--   partner_countries                 the sponsorship windows.
--   attribution_touches.source + SPN  fn_record_touch re-created verbatim with
--                                     the SPN- bucket; organic_signups_by_cid
--                                     widened so the brain's report sees SPN rows.
--   fn_sponsor_set                    flip a partner to sponsor, set its brokers.
--   fn_sponsor_window_set             write a window; one sponsor per country at a time.
--   fn_sponsor_windows                the windows, for the page header and range.
--   fn_sponsor_funnel                 counts per (signup week, ad label or null).
--   fn_sponsor_clients                the masked client rows, paginated.
--
-- Additive except for the two re-created functions, whose bodies change only by
-- their SPN line. Nothing here is readable by a browser: the new table has RLS
-- on and no policies, and every new function is granted to service_role alone.
-- Rollback dry run before applying (scripts/apply-sponsor-dashboard-migration.mjs
-- --dry-run), as with the partner and SEO migrations.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- partners — kind and brokers.
--
-- kind defaults to 'agency' so Ren's row and the agency dashboard are untouched.
-- brokers uses the same three ids as profiles.broker and deposit_events.broker;
-- a sponsor must name at least one, because every funding count is "funded
-- with the sponsor's broker".
-- ---------------------------------------------------------------------------
alter table public.partners
  add column if not exists kind    text   not null default 'agency',
  add column if not exists brokers text[];

alter table public.partners
  drop constraint if exists partners_kind_check;
alter table public.partners
  add constraint partners_kind_check check (kind in ('agency', 'sponsor'));

alter table public.partners
  drop constraint if exists partners_brokers_check;
alter table public.partners
  add constraint partners_brokers_check check (
    brokers is null or brokers <@ array['octa', 'dupoin', 'elev8']::text[]
  );

alter table public.partners
  drop constraint if exists partners_sponsor_has_brokers;
alter table public.partners
  add constraint partners_sponsor_has_brokers check (
    kind <> 'sponsor' or coalesce(array_length(brokers, 1), 0) > 0
  );

comment on column public.partners.kind is
  'agency: an ad partner reading AGY- cids (the original dashboard). sponsor: a broker reading its country windows in partner_countries and the SPN- cids.';
comment on column public.partners.brokers is
  'For sponsors: the broker ids (octa, dupoin, elev8) that count as funded with the sponsor. Octa holds {octa, elev8} because Elev8 is Octa''s brand.';


-- ---------------------------------------------------------------------------
-- partner_countries — the sponsorship windows.
--
-- One row per (sponsor, country, start). until is null for an open-ended deal.
-- The "one sponsor per country at a time" rule is enforced in
-- fn_sponsor_window_set, the only writer, rather than by an exclusion
-- constraint: this project has no btree_gist.
-- ---------------------------------------------------------------------------
create table if not exists public.partner_countries (
  slug       text        not null references public.partners(slug) on delete cascade,
  country    text        not null check (country ~ '^[A-Z]{2}$'),
  since      timestamptz not null,
  until      timestamptz check (until is null or until > since),
  created_at timestamptz not null default now(),
  primary key (slug, country, since)
);

comment on table public.partner_countries is
  'Sponsorship windows (design 2026-11-05 §2): the sponsor at slug paid for ads in country from since until until (null = open). Written only by fn_sponsor_window_set. Service role only.';

-- The funnel joins profiles on country and signup date.
create index if not exists partner_countries_country_idx
  on public.partner_countries (country, since);

alter table public.partner_countries enable row level security;

revoke all on public.partner_countries from anon, authenticated;


-- ---------------------------------------------------------------------------
-- The SPN cid family — SPN-<slug>-<ad name>, the sponsor-tagged ad.
--
-- Same shape and charset as AGY- (Meta substitutes the ad name, so spaces and
-- mixed case are expected). The constraint only widens; no row can violate it.
-- ---------------------------------------------------------------------------
alter table public.attribution_touches
  drop constraint if exists attribution_touches_source_check;
alter table public.attribution_touches
  add constraint attribution_touches_source_check
  check (source in ('AGY', 'CRT', 'ORG', 'EML', 'SEO', 'SPN', 'other'));

-- fn_record_touch — body copied verbatim from 20261001000001_seo_attribution.sql
-- (the live definition), with the SPN- bucket added.
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
  -- SEO-guide-<slug> and SPN-<slug>-<ad> are strict subsets of this.
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
    when v_cid like 'SPN-%' then 'SPN'
    else 'other'
  end;

  insert into public.attribution_touches (user_id, anon_id, cid, geo, source, path)
  values (p_user_id, v_anon, v_cid, v_geo, v_src, v_path);
end;
$$;

revoke all on function public.fn_record_touch(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.fn_record_touch(uuid, text, text, text, text) to service_role;

-- organic_signups_by_cid — body from the SEO migration, widened to SPN-%.
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
         or attr_cid like 'SEO-%' or attr_cid like 'SPN-%')
    and signup_at >= since
  group by attr_cid
$$;

revoke all on function public.organic_signups_by_cid(timestamptz) from public, anon, authenticated;
grant execute on function public.organic_signups_by_cid(timestamptz) to service_role;


-- ---------------------------------------------------------------------------
-- fn_sponsor_set — flip a partner to sponsor and set its brokers.
--
-- The partner row (and its key) comes from fn_partner_create; this only
-- changes kind and brokers. Brokers are lower-cased, de-duplicated and checked
-- against the ledger's list.
-- ---------------------------------------------------------------------------
create or replace function public.fn_sponsor_set(p_slug text, p_brokers text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug    text := lower(btrim(coalesce(p_slug, '')));
  v_brokers text[];
begin
  if v_slug !~ '^[a-z0-9]{2,24}$' then
    raise exception 'fn_sponsor_set: slug % must match ^[a-z0-9]{2,24}$', p_slug;
  end if;

  select coalesce(array_agg(x order by x), '{}'::text[])
    into v_brokers
    from (select distinct lower(btrim(b)) as x
            from unnest(coalesce(p_brokers, '{}'::text[])) as b
           where btrim(b) <> '') s;

  if coalesce(array_length(v_brokers, 1), 0) = 0 then
    raise exception 'fn_sponsor_set: a sponsor needs at least one broker';
  end if;
  if not (v_brokers <@ array['octa', 'dupoin', 'elev8']::text[]) then
    raise exception 'fn_sponsor_set: brokers % must be among octa, dupoin, elev8', v_brokers;
  end if;

  update public.partners
     set kind = 'sponsor', brokers = v_brokers
   where slug = v_slug;
  if not found then
    raise exception 'fn_sponsor_set: no partner %. Mint it first with fn_partner_create.', v_slug;
  end if;
end;
$$;

comment on function public.fn_sponsor_set(text, text[]) is
  'Make an existing partner a sponsor with the given brokers (octa, dupoin, elev8). Service role only.';

revoke all on function public.fn_sponsor_set(text, text[]) from public, anon, authenticated;
grant execute on function public.fn_sponsor_set(text, text[]) to service_role;


-- ---------------------------------------------------------------------------
-- fn_sponsor_window_set — write one sponsorship window.
--
-- One sponsor per country at a time: a window that overlaps ANOTHER sponsor's
-- window for the same country is refused. The SAME sponsor's overlapping
-- windows are replaced, so re-running with a corrected date is an edit rather
-- than a second, conflicting row. Ranges are half-open; a null until is open.
-- ---------------------------------------------------------------------------
create or replace function public.fn_sponsor_window_set(
  p_slug    text,
  p_country text,
  p_since   timestamptz,
  p_until   timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug    text := lower(btrim(coalesce(p_slug, '')));
  v_country text := upper(btrim(coalesce(p_country, '')));
  v_other   text;
begin
  if v_slug !~ '^[a-z0-9]{2,24}$' then
    raise exception 'fn_sponsor_window_set: slug % must match ^[a-z0-9]{2,24}$', p_slug;
  end if;
  if v_country !~ '^[A-Z]{2}$' then
    raise exception 'fn_sponsor_window_set: country % must be an ISO-2 code', p_country;
  end if;
  if p_since is null then
    raise exception 'fn_sponsor_window_set: since is required';
  end if;
  if p_until is not null and p_until <= p_since then
    raise exception 'fn_sponsor_window_set: until must be after since';
  end if;
  if not exists (select 1 from public.partners p where p.slug = v_slug and p.kind = 'sponsor') then
    raise exception 'fn_sponsor_window_set: % is not a sponsor. Run fn_sponsor_set first.', v_slug;
  end if;

  select pc.slug
    into v_other
    from public.partner_countries pc
   where pc.country = v_country
     and pc.slug <> v_slug
     and pc.since < coalesce(p_until, 'infinity'::timestamptz)
     and coalesce(pc.until, 'infinity'::timestamptz) > p_since
   limit 1;
  if v_other is not null then
    raise exception 'fn_sponsor_window_set: % already sponsors % over that period', v_other, v_country;
  end if;

  delete from public.partner_countries pc
   where pc.slug = v_slug
     and pc.country = v_country
     and pc.since < coalesce(p_until, 'infinity'::timestamptz)
     and coalesce(pc.until, 'infinity'::timestamptz) > p_since;

  insert into public.partner_countries (slug, country, since, until)
  values (v_slug, v_country, p_since, p_until);
end;
$$;

comment on function public.fn_sponsor_window_set(text, text, timestamptz, timestamptz) is
  'Write a sponsorship window. Refuses an overlap with another sponsor for the same country; replaces the same sponsor''s overlapping windows. Service role only.';

revoke all on function public.fn_sponsor_window_set(text, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.fn_sponsor_window_set(text, text, timestamptz, timestamptz) to service_role;


-- ---------------------------------------------------------------------------
-- fn_sponsor_windows — the windows, for the page header and the default range.
-- ---------------------------------------------------------------------------
create or replace function public.fn_sponsor_windows(p_slug text)
returns table (country text, since timestamptz, until timestamptz)
language sql
security definer
set search_path = ''
as $$
  select pc.country, pc.since, pc.until
    from public.partner_countries pc
    join public.partners p on p.slug = pc.slug and p.kind = 'sponsor'
   where pc.slug = lower(btrim(coalesce(p_slug, '')))
   order by pc.since, pc.country
$$;

revoke all on function public.fn_sponsor_windows(text) from public, anon, authenticated;
grant execute on function public.fn_sponsor_windows(text) to service_role;


-- ---------------------------------------------------------------------------
-- fn_sponsor_funnel — the dashboard's counts.
--
-- One row per (signup week, ad label). label is null for cohort members who did
-- not arrive through an SPN-<slug>- ad, so the page sums every row for the
-- headline and filters label-not-null for "directly traced". The cohort is
-- every non-admin profile whose country and signup date fall inside one of the
-- sponsor's windows, intersected with the requested range.
--
-- Funding, clicks and submissions count only against the sponsor's brokers.
-- Activation is the partner page's definition, verbatim.
-- ---------------------------------------------------------------------------
create or replace function public.fn_sponsor_funnel(
  p_slug  text,
  p_since timestamptz default null,
  p_until timestamptz default null
)
returns table (
  week           date,
  label          text,
  signups        int,
  activated      int,
  upgrade_viewed int,
  broker_clicked int,
  submitted      int,
  funded         int,
  deposit_total  numeric
)
language plpgsql
security definer
set search_path = ''
as $$
  #variable_conflict use_column
declare
  v_slug    text        := lower(btrim(coalesce(p_slug, '')));
  v_since   timestamptz := coalesce(p_since, '-infinity'::timestamptz);
  v_until   timestamptz := coalesce(p_until, now());
  v_brokers text[];
  v_prefix  text;
begin
  if v_slug !~ '^[a-z0-9]{2,24}$' then
    raise exception 'fn_sponsor_funnel: slug % must match ^[a-z0-9]{2,24}$', p_slug;
  end if;
  select p.brokers into v_brokers
    from public.partners p
   where p.slug = v_slug and p.kind = 'sponsor';
  if v_brokers is null then
    raise exception 'fn_sponsor_funnel: % is not a sponsor', v_slug;
  end if;
  v_prefix := 'SPN-' || v_slug || '-';

  return query
  with cohort as (
    select pr.id, pr.signup_at, pr.attr_cid, pr.deposit_verified_at, pr.broker,
           pr.tradingview_username, pr.kys_completed_at
      from public.profiles pr
      join public.partner_countries pc
        on pc.slug = v_slug
       and pc.country = pr.country
       and pr.signup_at >= pc.since
       and pr.signup_at <  coalesce(pc.until, 'infinity'::timestamptz)
     where pr.signup_at >= v_since
       and pr.signup_at <  v_until
       and not coalesce(pr.is_admin, false)
  ),
  scored as (
    select c.id,
           (date_trunc('week', c.signup_at))::date as wk,
           case when c.attr_cid like v_prefix || '%'
                then coalesce(nullif(substring(c.attr_cid from char_length(v_prefix) + 1), ''), '(unlabelled)')
           end as lbl,
           (c.tradingview_username is not null
            or c.kys_completed_at is not null
            or exists (select 1 from public.app_events e
                        where e.user_id = c.id and e.event = 'feature_view'
                          and e.props ->> 'feature' = 'daily-analysis')
            or exists (select 1 from public.app_events e
                        where e.user_id = c.id and e.event = 'onboarding_step_done')) as activated,
           exists (select 1 from public.app_events e
                    where e.user_id = c.id and e.event = 'upgrade_viewed') as viewed,
           exists (select 1 from public.app_events e
                    where e.user_id = c.id and e.event = 'upgrade_broker_link_clicked'
                      and e.props ->> 'broker' = any (v_brokers)) as clicked,
           exists (select 1 from public.app_events e
                    where e.user_id = c.id and e.event = 'deposit_submitted'
                      and e.props ->> 'broker' = any (v_brokers)) as submitted,
           (c.deposit_verified_at is not null and c.broker = any (v_brokers)) as funded
      from cohort c
  )
  select s.wk,
         s.lbl,
         count(*)::int,
         count(*) filter (where s.activated)::int,
         count(*) filter (where s.viewed)::int,
         count(*) filter (where s.clicked)::int,
         count(*) filter (where s.submitted)::int,
         count(*) filter (where s.funded)::int,
         round(coalesce(sum(case when s.funded then (
             select coalesce(sum(d.amount), 0)
               from public.deposit_events d
              where d.user_id = s.id and d.broker = any (v_brokers)) else 0 end), 0), 2)
    from scored s
   group by s.wk, s.lbl
   order by s.wk, s.lbl nulls first;
end;
$$;

comment on function public.fn_sponsor_funnel(text, timestamptz, timestamptz) is
  'Sponsor funnel counts per (signup week, ad label or null) for the sponsor''s country windows. Counts only. Service role only.';

revoke all on function public.fn_sponsor_funnel(text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.fn_sponsor_funnel(text, timestamptz, timestamptz) to service_role;


-- ---------------------------------------------------------------------------
-- fn_sponsor_clients — the masked client rows, newest first, paginated.
--
-- Same cohort and stage facts as fn_sponsor_funnel. What leaves this function
-- is the design's §2 list and nothing more: the display name is the first
-- given name plus the last initial; the trading account number appears only
-- once the person has funded with the sponsor's broker (which the broker
-- already holds); no contact column is selected anywhere in this body.
-- total is the window count for the page's "Page x of y".
-- ---------------------------------------------------------------------------
create or replace function public.fn_sponsor_clients(
  p_slug   text,
  p_since  timestamptz default null,
  p_until  timestamptz default null,
  p_limit  int default 50,
  p_offset int default 0
)
returns table (
  total          bigint,
  signed_up      date,
  country        text,
  display        text,
  stage          text,
  ad_label       text,
  account_number text,
  deposit_total  numeric
)
language plpgsql
security definer
set search_path = ''
as $$
  #variable_conflict use_column
declare
  v_slug    text        := lower(btrim(coalesce(p_slug, '')));
  v_since   timestamptz := coalesce(p_since, '-infinity'::timestamptz);
  v_until   timestamptz := coalesce(p_until, now());
  v_limit   int         := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset  int         := greatest(coalesce(p_offset, 0), 0);
  v_brokers text[];
  v_prefix  text;
begin
  if v_slug !~ '^[a-z0-9]{2,24}$' then
    raise exception 'fn_sponsor_clients: slug % must match ^[a-z0-9]{2,24}$', p_slug;
  end if;
  select p.brokers into v_brokers
    from public.partners p
   where p.slug = v_slug and p.kind = 'sponsor';
  if v_brokers is null then
    raise exception 'fn_sponsor_clients: % is not a sponsor', v_slug;
  end if;
  v_prefix := 'SPN-' || v_slug || '-';

  return query
  with cohort as (
    select pr.id, pr.signup_at, pr.country, pr.full_name, pr.attr_cid,
           pr.deposit_verified_at, pr.broker, pr.trading_account_number,
           pr.tradingview_username, pr.kys_completed_at
      from public.profiles pr
      join public.partner_countries pc
        on pc.slug = v_slug
       and pc.country = pr.country
       and pr.signup_at >= pc.since
       and pr.signup_at <  coalesce(pc.until, 'infinity'::timestamptz)
     where pr.signup_at >= v_since
       and pr.signup_at <  v_until
       and not coalesce(pr.is_admin, false)
  ),
  scored as (
    select c.id, c.signup_at, c.country, c.attr_cid, c.trading_account_number,
           nullif(btrim(regexp_replace(coalesce(c.full_name, ''), '\s+', ' ', 'g')), '') as nm,
           (c.tradingview_username is not null
            or c.kys_completed_at is not null
            or exists (select 1 from public.app_events e
                        where e.user_id = c.id and e.event = 'feature_view'
                          and e.props ->> 'feature' = 'daily-analysis')
            or exists (select 1 from public.app_events e
                        where e.user_id = c.id and e.event = 'onboarding_step_done')) as activated,
           exists (select 1 from public.app_events e
                    where e.user_id = c.id and e.event = 'upgrade_viewed') as viewed,
           exists (select 1 from public.app_events e
                    where e.user_id = c.id and e.event = 'upgrade_broker_link_clicked'
                      and e.props ->> 'broker' = any (v_brokers)) as clicked,
           exists (select 1 from public.app_events e
                    where e.user_id = c.id and e.event = 'deposit_submitted'
                      and e.props ->> 'broker' = any (v_brokers)) as submitted,
           (c.deposit_verified_at is not null and c.broker = any (v_brokers)) as funded
      from cohort c
  )
  select count(*) over ()::bigint,
         (s.signup_at at time zone 'UTC')::date,
         s.country,
         case when s.nm is null then null
              when position(' ' in s.nm) = 0 then left(s.nm, 24)
              else left(split_part(s.nm, ' ', 1), 24) || ' '
                   || upper(left(regexp_replace(s.nm, '^.*\s', ''), 1)) || '.'
         end,
         case when s.funded then 'funded'
              when s.submitted then 'submitted'
              when s.clicked then 'broker_clicked'
              when s.viewed then 'upgrade_viewed'
              when s.activated then 'activated'
              else 'signed_up'
         end,
         case when s.attr_cid like v_prefix || '%'
              then coalesce(nullif(substring(s.attr_cid from char_length(v_prefix) + 1), ''), '(unlabelled)')
         end,
         case when s.funded then s.trading_account_number end,
         case when s.funded then round((
             select coalesce(sum(d.amount), 0)
               from public.deposit_events d
              where d.user_id = s.id and d.broker = any (v_brokers)), 2)
         end
    from scored s
   order by s.signup_at desc, s.id
   limit v_limit offset v_offset;
end;
$$;

comment on function public.fn_sponsor_clients(text, timestamptz, timestamptz, int, int) is
  'Masked client rows for a sponsor''s cohort: signup date, country, first name + initial, stage, traced ad, and the trading account number only once funded with the sponsor''s broker. Service role only.';

revoke all on function public.fn_sponsor_clients(text, timestamptz, timestamptz, int, int) from public, anon, authenticated;
grant execute on function public.fn_sponsor_clients(text, timestamptz, timestamptz, int, int) to service_role;
