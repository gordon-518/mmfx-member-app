-- ============================================================================
-- Partner attribution — the AGY- tag, the touch log, the partner funnel
-- (design doc 2026-09-25, Part A1).
--
-- Ren runs Meta ads for MMFX on their own ad account. They see clicks; they
-- cannot see signups, activation or funded clients, and MMFX cannot see which
-- funded clients came from them. Both sides need the same numbers out of the
-- same table, and the partner must never see anything but counts.
--
-- What ships here:
--
--   attribution_touches        every attributable landing, not just the one
--                              at signup. profiles.attr_cid answers "which ad
--                              brought them in"; nothing answered "which ad
--                              was the last one they saw before they funded".
--   profiles.attr_last_cid/_at the latest-touch answer without a table scan,
--                              stamped by a trigger on the log.
--   partners                   slug, display name, sha256 of the dashboard
--                              key, and the optional weekly report address.
--   fn_record_touch            the ONE door into the log (service role).
--   fn_partner_create          mints a key, returns it once, stores the hash.
--   fn_partner_funnel          the whole dashboard, in counts, per (week, ad).
--   fn_app_event_insert        re-created: + 'cid_visit' on the allowlist.
--   fn_set_signup_attribution  re-created: the cid check widened to the AGY-
--                              shape (Meta ad names carry spaces and run well
--                              past 64 characters — see the note above it).
--   organic_signups_by_cid     widened to AGY-%, so the brain's weekly report
--                              picks up partner rows with no new code path.
--
-- Additive except for the three re-created functions and
-- organic_signups_by_cid, which is dropped and re-created because its body
-- changes (the signature and grants are restated unchanged).
--
-- Nothing here is readable by a browser: both new tables have RLS on and no
-- policies, and every new function is granted to service_role alone.
--
-- Ops notes (the pg_cron job for the weekly partner email) are at the FOOT of
-- this file.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- attribution_touches — one row per attributable landing.
--
-- user_id is nullable on purpose: a touch can be recorded for a visitor we
-- have not identified yet (anon_id), and the row is still worth keeping. One
-- of the two is always present; fn_record_touch enforces that.
--
-- cid is stored RAW (trimmed to 120 chars), because the label half of an
-- AGY- cid is a Meta ad name: spaces, mixed case and punctuation are normal
-- and normalising them would stop the label matching what Ren sees in Ads
-- Manager. The funnel groups on the label as it was written.
--
-- No unique key. Two landings a second apart are two touches; the reporting
-- side only ever asks for the LATEST one in a window, so duplicates cost
-- storage and nothing else.
-- ---------------------------------------------------------------------------
create table if not exists public.attribution_touches (
  id        bigint generated always as identity primary key,
  user_id   uuid references public.profiles(id) on delete cascade,
  anon_id   text,
  cid       text not null,
  geo       text,
  source    text not null check (source in ('AGY','CRT','ORG','EML','other')),
  landed_at timestamptz not null default now(),
  path      text
);

comment on table public.attribution_touches is
  'Every attributable landing (design 2026-09-25 §2.2), not just the signup one. Written only through fn_record_touch (service role). Read by fn_partner_funnel for the last_paid_7d rule.';

-- The funnel's only access pattern: this user''s touches, newest first.
create index if not exists attribution_touches_user_idx
  on public.attribution_touches (user_id, landed_at desc);
-- Ad-level spot checks ("did AGY-ren-Gold Hook 03 land at all?").
create index if not exists attribution_touches_cid_idx
  on public.attribution_touches (cid, landed_at desc);

alter table public.attribution_touches enable row level security;

revoke all on public.attribution_touches from anon, authenticated;


-- ---------------------------------------------------------------------------
-- profiles.attr_last_cid / attr_last_at — the latest touch, denormalised.
--
-- attr_cid (2026-09-03) is FIRST touch and never moves. These two are LAST
-- touch and always move. Both are needed: the first answers "who sourced this
-- member", the last answers "what were they looking at before they funded",
-- and the payout rule in §2.3 is argued between them.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists attr_last_cid text,
  add column if not exists attr_last_at  timestamptz;

comment on column public.profiles.attr_last_cid is
  'The cid of the most recent attribution_touches row for this user (any source, any time). Stamped by the attribution_touches_stamp trigger. attr_cid is the first-touch counterpart and is never overwritten.';

create or replace function public.fn_stamp_attr_last()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Anonymous touches have no profile to stamp.
  if new.user_id is null then
    return null;
  end if;

  update public.profiles p
  set attr_last_cid = new.cid,
      attr_last_at  = new.landed_at
  where p.id = new.user_id
    -- A backfilled or out-of-order insert must never walk the stamp
    -- backwards: only a touch at least as recent as the stamp replaces it.
    and (p.attr_last_at is null or p.attr_last_at <= new.landed_at);

  return null;
end;
$$;

revoke all on function public.fn_stamp_attr_last() from public, anon, authenticated;

create or replace trigger attribution_touches_stamp
  after insert on public.attribution_touches
  for each row execute function public.fn_stamp_attr_last();


-- ---------------------------------------------------------------------------
-- fn_record_touch — the one door into the log.
--
-- Called from two places, both server-side: the signup action (once, with the
-- cookie's cid) and the proxy (on every signed-in landing that carries a
-- recognisable cid). Both hold the service-role key; no browser can reach it.
--
-- Everything it is handed comes from a URL or a cookie, so it validates and
-- drops rather than raising: attribution must never break a signup or a page
-- render. A cid that fails the shape check is simply not a touch.
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
    else 'other'
  end;

  insert into public.attribution_touches (user_id, anon_id, cid, geo, source, path)
  values (p_user_id, v_anon, v_cid, v_geo, v_src, v_path);
end;
$$;

comment on function public.fn_record_touch(uuid, text, text, text, text) is
  'Record one attribution touch. Validates and DROPS bad input rather than raising — attribution must never break a signup. Service role only.';

revoke all on function public.fn_record_touch(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.fn_record_touch(uuid, text, text, text, text) to service_role;


-- ---------------------------------------------------------------------------
-- partners — who may open a dashboard, and with which key.
--
-- The raw key is never stored. fn_partner_create returns it once; if it is
-- lost, the fix is to mint a new one, which is the correct behaviour for a
-- bearer credential that sits in a URL.
--
-- report_email is null until Gordon fills it in (§2.7): the weekly route
-- skips a partner without one, so shipping the column early costs nothing.
--
-- The slug is HYPHEN-FREE. The tag is AGY-<slug>-<label> and the label is a
-- Meta ad name, which routinely contains hyphens — so if the slug could carry
-- one too, the split between "who gets paid" and "which ad" would be
-- ambiguous. The brain's parser refuses a hyphenated slug for the same
-- reason, and so does the marketing site's /a/<slug> route.
-- ---------------------------------------------------------------------------
create table if not exists public.partners (
  slug         text primary key check (slug ~ '^[a-z0-9]{2,24}$'),
  name         text not null,
  key_hash     text not null,
  active       boolean not null default true,
  report_email text,
  created_at   timestamptz not null default now()
);

comment on table public.partners is
  'Ad partners with a read-only funnel dashboard at /partners/<slug>?key=… . key_hash is the sha256 hex of the bearer key; the raw key exists only in the fn_partner_create return value. Service role only.';

alter table public.partners enable row level security;

revoke all on public.partners from anon, authenticated;


-- 32 bytes of key material from the core CSPRNG. This project has no pgcrypto
-- (so no gen_random_bytes / digest), and pg_catalog.gen_random_uuid and
-- pg_catalog.sha256 are both core and both reachable with search_path = ''.
-- Two v4 uuids, hyphens stripped, are 64 hex characters = 32 bytes.
create or replace function public.fn_partner_create(p_slug text, p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_key  text := replace(pg_catalog.gen_random_uuid()::text, '-', '')
              || replace(pg_catalog.gen_random_uuid()::text, '-', '');
begin
  if v_slug !~ '^[a-z0-9]{2,24}$' then
    raise exception 'fn_partner_create: slug % must match ^[a-z0-9]{2,24}$', p_slug;
  end if;

  insert into public.partners (slug, name, key_hash)
  values (v_slug, coalesce(v_name, v_slug), encode(pg_catalog.sha256(v_key::bytea), 'hex'))
  -- Re-running it ROTATES the key: the old one stops working immediately,
  -- which is the only way to revoke a key that has leaked.
  on conflict (slug) do update
    set key_hash = excluded.key_hash,
        name     = coalesce(v_name, public.partners.name),
        active   = true;

  return v_key;
end;
$$;

comment on function public.fn_partner_create(text, text) is
  'Mint (or rotate) a partner dashboard key. Returns the raw key ONCE — only its sha256 is stored. Service role only.';

revoke all on function public.fn_partner_create(text, text) from public, anon, authenticated;
grant execute on function public.fn_partner_create(text, text) to service_role;


-- ---------------------------------------------------------------------------
-- fn_partner_funnel — the entire dashboard, in counts.
--
-- One row per (signup week, ad label) for profiles attributed to this
-- partner. The cohort is defined by SIGNUP date: a person belongs to the week
-- they signed up in, and `funded` asks how many of that week's signups have
-- since verified a deposit. That keeps every person in exactly one row and
-- makes the columns read left to right as one funnel.
--
-- Two attribution rules, both computed from the same cohort (§2.3):
--
--   first          profiles.attr_cid — the touch that was on the cookie at
--                  signup, never overwritten.
--   last_paid_7d   the latest AGY/CRT touch in the 7 days BEFORE the anchor.
--                  The anchor differs per metric, and that is deliberate: a
--                  signup is anchored on signup_at, a funded client on
--                  deposit_verified_at. A person can therefore count as a
--                  signup for one ad and as a funded client for another —
--                  which is what "last paid touch" means.
--
-- first_touch_signups / first_touch_funded are ALWAYS first touch, whatever
-- p_rule says, so the dashboard can show the two answers side by side and a
-- dispute is visible rather than hidden.
--
-- The partner sees this function's output and nothing else. It selects no
-- email, no name, no broker or IB identifier and no rate (§2.5).
-- ---------------------------------------------------------------------------
create or replace function public.fn_partner_funnel(
  p_slug  text,
  p_since timestamptz,
  p_until timestamptz,
  p_rule  text default 'last_paid_7d'
)
returns table (
  week                date,
  label               text,
  signups             int,
  activated           int,
  funded              int,
  deposit_total       numeric,
  first_touch_signups int,
  first_touch_funded  int
)
language plpgsql
security definer
set search_path = ''
as $$
  -- RETURNS TABLE declares week, label, signups … as OUT variables, so a bare
  -- `week` in a GROUP BY inside the body is ambiguous (42702 on Postgres 17).
  -- Every column reference below is qualified; the OUT names are only ever
  -- assigned through RETURN QUERY, so resolving clashes to the column is safe.
  #variable_conflict use_column
declare
  v_slug   text        := lower(btrim(coalesce(p_slug, '')));
  v_rule   text        := case
                            when lower(btrim(coalesce(p_rule, ''))) = 'first' then 'first'
                            else 'last_paid_7d'
                          end;
  v_since  timestamptz := coalesce(p_since, now() - interval '30 days');
  v_until  timestamptz := coalesce(p_until, now());
  v_prefix text;
begin
  if v_slug !~ '^[a-z0-9]{2,24}$' then
    raise exception 'fn_partner_funnel: slug % must match ^[a-z0-9]{2,24}$', p_slug;
  end if;

  v_prefix := 'AGY-' || v_slug || '-';

  return query
  with cohort as (
    select pr.id,
           pr.signup_at,
           pr.deposit_verified_at,
           coalesce(pr.deposit_amount, 0)::numeric as deposit_amount,
           pr.attr_cid,
           pr.tradingview_username,
           pr.kys_completed_at
      from public.profiles pr
     where pr.signup_at >= v_since
       and pr.signup_at <  v_until
  ),
  -- The last paid touch before each anchor. Two scalar subqueries rather than
  -- one window function: the index is (user_id, landed_at desc), so each is a
  -- single backwards index probe per person.
  paid as (
    select c.id,
           (select t.cid
              from public.attribution_touches t
             where t.user_id = c.id
               and t.source in ('AGY', 'CRT')
               and t.landed_at <= c.signup_at
               and t.landed_at >= c.signup_at - interval '7 days'
             order by t.landed_at desc
             limit 1) as signup_paid_cid,
           (select t.cid
              from public.attribution_touches t
             where t.user_id = c.id
               and c.deposit_verified_at is not null
               and t.source in ('AGY', 'CRT')
               and t.landed_at <= c.deposit_verified_at
               and t.landed_at >= c.deposit_verified_at - interval '7 days'
             order by t.landed_at desc
             limit 1) as funded_paid_cid
      from cohort c
  ),
  -- Activation (§2.5): any one of the four first-value moments. Deliberately
  -- looser than /stats' 48-hour definition — a partner is being told whether
  -- the people they sent did anything at all, not whether they onboarded fast.
  act as (
    select c.id,
           (c.tradingview_username is not null
            or c.kys_completed_at is not null
            or exists (select 1
                         from public.app_events e
                        where e.user_id = c.id
                          and e.event = 'feature_view'
                          and e.props ->> 'feature' = 'daily-analysis')
            or exists (select 1
                         from public.app_events e
                        where e.user_id = c.id
                          and e.event = 'onboarding_step_done')
           ) as activated
      from cohort c
  ),
  scored as (
    select c.id,
           (date_trunc('week', c.signup_at))::date as wk,
           c.deposit_verified_at,
           c.deposit_amount,
           a.activated,
           c.attr_cid as first_cid,
           case when v_rule = 'first' then c.attr_cid else p.signup_paid_cid end as signup_cid,
           case when v_rule = 'first' then c.attr_cid else p.funded_paid_cid end as funded_cid
      from cohort c
      join paid p on p.id = c.id
      join act  a on a.id = c.id
  ),
  -- One contribution per metric, so the signup side and the funded side can
  -- land on DIFFERENT ads for the same person under last_paid_7d.
  contrib as (
    select s.wk, s.signup_cid as cid,
           1 as n_signups,
           (case when s.activated then 1 else 0 end) as n_activated,
           0 as n_funded, 0::numeric as n_deposit,
           0 as n_ft_signups, 0 as n_ft_funded
      from scored s
     where s.signup_cid like v_prefix || '%'
    union all
    select s.wk, s.funded_cid, 0, 0, 1, s.deposit_amount, 0, 0
      from scored s
     where s.deposit_verified_at is not null
       and s.funded_cid like v_prefix || '%'
    union all
    select s.wk, s.first_cid, 0, 0, 0, 0::numeric, 1, 0
      from scored s
     where s.first_cid like v_prefix || '%'
    union all
    select s.wk, s.first_cid, 0, 0, 0, 0::numeric, 0, 1
      from scored s
     where s.deposit_verified_at is not null
       and s.first_cid like v_prefix || '%'
  )
  select x.wk,
         coalesce(nullif(substring(x.cid from char_length(v_prefix) + 1), ''), '(unlabelled)'),
         sum(x.n_signups)::int,
         sum(x.n_activated)::int,
         sum(x.n_funded)::int,
         round(sum(x.n_deposit), 2),
         sum(x.n_ft_signups)::int,
         sum(x.n_ft_funded)::int
    from contrib x
   group by x.wk, 2
   order by x.wk, 2;
end;
$$;

comment on function public.fn_partner_funnel(text, timestamptz, timestamptz, text) is
  'Partner funnel counts per (signup week, ad label) for AGY-<slug>- cids, under p_rule = last_paid_7d (default) or first. Counts only — no email, name, broker or rate. Service role only.';

revoke all on function public.fn_partner_funnel(text, timestamptz, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.fn_partner_funnel(text, timestamptz, timestamptz, text) to service_role;


-- ---------------------------------------------------------------------------
-- The app_events allowlist — + 'cid_visit'.
--
-- Body copied verbatim from 20260922000001_email_measurement.sql (the live
-- definition), with the name added and the email_visit dedupe arm widened to
-- cover it: both events key on the cid, and both mean "this person landed
-- from this link", so one visit per cid per day is the right resolution.
--
-- email_visit is UNCHANGED and still emitted for EML- cids, so every email
-- KPI reads exactly what it read yesterday. cid_visit is the wider signal:
-- one row for every AGY/CRT/ORG/EML landing by a signed-in member.
--
-- Both are SERVER-ONLY. fn_log_event (the browser's door) is restated below
-- unchanged, so it is obvious in review that neither was added to it.
-- ---------------------------------------------------------------------------
create or replace function public.fn_app_event_insert(
  p_user_id uuid,
  p_event   text,
  p_props   jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- v_ prefix: a bare "props" is ambiguous with app_events.props in the
  -- dedupe query below and makes every call fail.
  v_props jsonb := coalesce(p_props, '{}'::jsonb);
begin
  if p_user_id is null then
    raise exception 'fn_app_event_insert: user id required';
  end if;

  if p_event is null or p_event not in (
    'feature_view',
    'tv_username_set',
    'upgrade_viewed',
    'upgrade_broker_link_clicked',
    'upgrade_contact_clicked',
    'deposit_verified',
    'tier_changed',
    'onboarding_step_done',
    'deposit_submitted',
    'email_visit',
    'cid_visit'   -- added (partners §2.2): any attributable landing
  ) then
    raise exception 'fn_app_event_insert: event % is not on the allowlist', p_event;
  end if;

  if jsonb_typeof(v_props) <> 'object' then
    raise exception 'fn_app_event_insert: props must be a JSON object';
  end if;

  if pg_column_size(v_props) > 1024 then
    raise exception 'fn_app_event_insert: props exceed 1 KB';
  end if;

  -- One feature_view per user + feature per 30 minutes. Refreshes and
  -- back-navigation would otherwise bury the signal under duplicate rows.
  if p_event = 'feature_view' and exists (
    select 1
    from public.app_events e
    where e.user_id = p_user_id
      and e.event = 'feature_view'
      and e.props ->> 'feature' = v_props ->> 'feature'
      and e.created_at > now() - interval '30 minutes'
  ) then
    return;
  end if;

  -- A checklist step is done once; later repeats are no-ops.
  if p_event = 'onboarding_step_done' and exists (
    select 1
    from public.app_events e
    where e.user_id = p_user_id
      and e.event = 'onboarding_step_done'
      and e.props ->> 'step' = v_props ->> 'step'
  ) then
    return;
  end if;

  -- One visit per link per user per day. The cid names the link, so a
  -- refresh, a second tab or a back-navigation is the same visit, not a new
  -- one. (Was email_visit only; cid_visit joins it — partners §2.2.)
  if p_event in ('email_visit', 'cid_visit') and exists (
    select 1
    from public.app_events e
    where e.user_id = p_user_id
      and e.event = p_event
      and e.props ->> 'cid' = v_props ->> 'cid'
      and e.created_at > now() - interval '24 hours'
  ) then
    return;
  end if;

  insert into public.app_events (user_id, event, props)
  values (p_user_id, p_event, v_props);
end;
$$;

revoke all on function public.fn_app_event_insert(uuid, text, jsonb)
  from public, anon, authenticated;


-- Restated verbatim (20260922000001) so this migration carries the whole
-- server-side path in one place: the only door cid_visit comes through.
create or replace function public.fn_log_event_as(
  p_user_id uuid,
  p_event   text,
  p_props   jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.fn_app_event_insert(p_user_id, p_event, p_props);
end;
$$;

revoke all on function public.fn_log_event_as(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.fn_log_event_as(uuid, text, jsonb) to service_role;


-- The browser's door, restated UNCHANGED, so it is obvious in review that
-- cid_visit was NOT added to it.
create or replace function public.fn_log_event(
  p_event text,
  p_props jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'fn_log_event: no authenticated user';
  end if;

  if p_event is null or p_event not in (
    'upgrade_broker_link_clicked',
    'upgrade_contact_clicked',
    'onboarding_step_done'
  ) then
    raise exception 'fn_log_event: % cannot be logged from the client', p_event;
  end if;

  perform public.fn_app_event_insert(uid, p_event, p_props);
end;
$$;

revoke all on function public.fn_log_event(text, jsonb) from public, anon;
grant execute on function public.fn_log_event(text, jsonb) to authenticated;


-- ---------------------------------------------------------------------------
-- fn_set_signup_attribution — the cid check widened to the AGY- shape.
--
-- Body copied verbatim from 20260910000002_funnel_instrumentation.sql (the
-- live definition) with ONE change, marked below.
--
-- The old check was `^[A-Za-z0-9_-]{1,64}$`. An AGY- cid carries a Meta ad
-- name substituted from {{ad.name}} — "AGY-ren-Gold Hook 03 · MY" is an
-- ordinary one — so under the old check every partner signup would have
-- silently dropped its attribution, exactly the class of bug conversion-fix
-- 1.1 existed to fix. The new check is the same charset fn_record_touch
-- accepts, capped at the same 120 characters, and the value is truncated
-- rather than rejected on length so a long ad name still attributes.
--
-- Still a drop-not-raise: a cid that fails the check is discarded and the
-- signup proceeds. Still first-touch-only, still within 24h of signup.
-- ---------------------------------------------------------------------------
create or replace function public.fn_set_signup_attribution(
  p_cid     text,
  p_geo     text,
  p_feature text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid     uuid := (select auth.uid());
  -- changed (partners §2.1): trim to 120 rather than reject a long ad name.
  cid     text := nullif(left(btrim(p_cid), 120), '');
  geo     text := upper(nullif(btrim(p_geo), ''));
  feature text := lower(nullif(btrim(p_feature), ''));
begin
  if uid is null then
    raise exception 'fn_set_signup_attribution: no authenticated user';
  end if;

  -- The cookie is client-controlled. Keep only well-formed values and drop the
  -- rest rather than raising: attribution must never break a signup.
  -- changed (partners §2.1): the AGY- charset, not the old 64-char one.
  if cid is not null and cid !~ '^[A-Za-z0-9._%~ -]{1,120}$' then cid := null; end if;
  if geo is not null and geo !~ '^[A-Z]{2}$' then geo := null; end if;
  if feature is not null and feature !~ '^[a-z0-9-]{1,40}$' then feature := null; end if;

  if cid is null and geo is null and feature is null then
    return;
  end if;

  update public.profiles p
  set attr_cid     = cid,
      attr_geo     = geo,
      attr_feature = feature
  where p.id = uid
    -- First touch wins, on the whole tuple: a later visit never overwrites it.
    and p.attr_cid is null
    and p.attr_geo is null
    and p.attr_feature is null
    -- Signup-time only. Without this, an existing user who later signs in
    -- (e.g. with Google) carrying a fresh ad cookie would have an old signup
    -- re-attributed to that ad.
    and p.signup_at > now() - interval '24 hours';
end;
$$;

revoke all on function public.fn_set_signup_attribution(text, text, text) from public, anon;
grant execute on function public.fn_set_signup_attribution(text, text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- organic_signups_by_cid — + AGY-%.
--
-- The brain's weekly report reads this through /api/organic/attribution and
-- passes the rows straight through. Adding the prefix here is the whole of
-- §2.8's member-app half: partner signups and deposits appear in the weekly
-- line with no new code path on either side.
--
-- Dropped and re-created (the body changes); the signature, the grants and
-- the name are unchanged.
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
    and (attr_cid like 'ORG-%' or attr_cid like 'EML-%' or attr_cid like 'AGY-%')
    and signup_at >= since
  group by attr_cid
$$;

revoke all on function public.organic_signups_by_cid(timestamptz) from public, anon, authenticated;
grant execute on function public.organic_signups_by_cid(timestamptz) to service_role;

comment on function public.organic_signups_by_cid(timestamptz) is
  'Signups and verified deposits per attribution cid (ORG-% organic, EML-% lifecycle email, AGY-% ad partner) since a cutoff. Service role only; read by /api/organic/attribution.';


-- ============================================================================
-- OPS — the one thing Gordon has to do by hand after this ships.
--
-- The weekly partner email (§2.7). pg_cron and pg_net are already enabled by
-- 20260921000001; the CRON_SECRET and the app URL must NOT be committed, so
-- apply the schedule out-of-band in the Supabase SQL Editor with the live
-- values. Re-running cron.schedule with the same job name updates it in place.
--
-- RUN THIS ONCE IN THE SUPABASE SQL EDITOR (replace the two placeholders):
--
--   select cron.schedule(
--     'partner-weekly',
--     '0 1 * * 1',
--     $$
--       select net.http_post(
--         url     := 'https://APP_URL/api/cron/partner-weekly',
--         headers := jsonb_build_object(
--           'Content-Type',  'application/json',
--           'Authorization', 'Bearer CRON_SECRET_VALUE'
--         ),
--         body    := '{}'::jsonb,
--         timeout_milliseconds := 290000
--       );
--     $$
--   );
--
-- Verify:     select jobname, schedule, active from cron.job;
-- Unschedule: select cron.unschedule('partner-weekly');
--
-- Monday 01:00 UTC is Monday 09:00 SGT. Safe to schedule immediately: the
-- route sends to active partners that have a report_email, and no partner has
-- one until Gordon sets it:
--
--   update public.partners set report_email = 'someone@agency' where slug = 'ren';
--
-- MINT REN'S KEY (service role — SQL Editor runs as postgres, which is fine):
--
--   select public.fn_partner_create('ren', 'Ren');
--
-- It returns the raw key ONCE. Hand it to Ren with the dashboard link:
--
--   https://app.marketmakersfx.net/partners/ren?key=<key>
--
-- Re-running it rotates the key and invalidates the old link.
-- ============================================================================
