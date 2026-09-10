-- ============================================================================
-- Conversion-fix Phase 1 — instrument the funnel (docs/conversion-fix-plan.md).
--
--   1.3  app_events + its writers         (created first; later sections use it)
--   1.1  fn_set_signup_attribution        (fixes the silent-RLS attribution bug)
--   1.2  fn_resolve_trial_status          (+ throttled last_activity_at stamp)
--   1.4  profiles.tv_connected_at         (+ set in fn_set_tradingview_username)
--   1.5  fn_admin_funnel_stats            (activation + upgrade funnel, /stats)
--
-- Additive only. The bodies re-created for 1.2 and 1.4 are copied verbatim from
-- the LIVE definitions (pg_get_functiondef, 10 Sep 2026), not from older
-- migration files, with only the marked additions.
--
-- Grant pattern throughout: revoke from public (anon/authenticated inherit
-- EXECUTE from PUBLIC, so revoking those two alone is not enough), then grant
-- explicitly to the one role that should call it.
-- ============================================================================


-- ─── 1.3  The event log ─────────────────────────────────────────────────────

create table if not exists public.app_events (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  event       text        not null,
  props       jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists app_events_user_created_idx
  on public.app_events (user_id, created_at desc);
create index if not exists app_events_event_created_idx
  on public.app_events (event, created_at desc);

comment on table public.app_events is
  'Funnel event log (conversion-fix 1.3). Admin SELECT only. Writes go through fn_log_event (browser clicks, auth.uid()) or fn_log_event_as (server, service_role), both via fn_app_event_insert.';

alter table public.app_events enable row level security;

revoke all on public.app_events from anon, authenticated;
grant select on public.app_events to authenticated;

drop policy if exists "app_events_select_admin" on public.app_events;
create policy "app_events_select_admin"
  on public.app_events
  for select
  to authenticated
  using ( public.is_admin() );


-- Internal writer: the ONLY thing that inserts into app_events. Validates the
-- event name against the allowlist, caps the props payload, and dedupes page
-- views. Callable by no client role — reached only through the two wrappers.
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
    'deposit_verified'
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

  insert into public.app_events (user_id, event, props)
  values (p_user_id, p_event, v_props);
end;
$$;

revoke all on function public.fn_app_event_insert(uuid, text, jsonb)
  from public, anon, authenticated;


-- Browser-originated events. The user comes from auth.uid(), and only the two
-- click events are accepted — a user cannot forge deposit_verified or
-- feature_view from the client.
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
    'upgrade_contact_clicked'
  ) then
    raise exception 'fn_log_event: % cannot be logged from the client', p_event;
  end if;

  perform public.fn_app_event_insert(uid, p_event, p_props);
end;
$$;

revoke all on function public.fn_log_event(text, jsonb) from public, anon;
grant execute on function public.fn_log_event(text, jsonb) to authenticated;


-- Server-originated events, for a user the server has ALREADY authenticated:
-- page renders logging via Next's after() (cookies are unavailable there, so
-- the session client can't be used) and admin actions acting on another user.
-- service_role only; never reachable from a browser.
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


-- ─── 1.1  Signup attribution ────────────────────────────────────────────────
-- signup/actions.ts wrote attr_* with a direct .update() from the session
-- client. profiles has SELECT policies only, so RLS matched zero rows and
-- returned no error: every signup from 3–10 Sep lost its attribution. This
-- does the write as definer, on the caller's own row only.

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
  cid     text := nullif(btrim(p_cid), '');
  geo     text := upper(nullif(btrim(p_geo), ''));
  feature text := lower(nullif(btrim(p_feature), ''));
begin
  if uid is null then
    raise exception 'fn_set_signup_attribution: no authenticated user';
  end if;

  -- The cookie is client-controlled. Keep only well-formed values and drop the
  -- rest rather than raising: attribution must never break a signup.
  if cid is not null and cid !~ '^[A-Za-z0-9_-]{1,64}$' then cid := null; end if;
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


-- ─── 1.2  Activity stamp ────────────────────────────────────────────────────
-- LIVE body verbatim, plus the marked stamp. create or replace keeps the
-- existing grants (authenticated, service_role).

create or replace function public.fn_resolve_trial_status()
returns public.profiles
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid    uuid := (select auth.uid());
  result public.profiles;
begin
  if uid is null then
    raise exception 'fn_resolve_trial_status: no authenticated user';
  end if;

  -- Flip an expired active trial. WHERE guarantees we only ever touch the
  -- caller's own row, and only when it is genuinely a lapsed active trial.
  update public.profiles p
  set
    account_status = case p.account_status
      when 'trial_active'    then 'trial_expired'
      when 're_trial_active' then 're_trial_expired'
      else p.account_status
    end,
    downgraded_at = now()
  where p.id = uid
    and p.account_status in ('trial_active', 're_trial_active')
    and now() > p.trial_ends_at
  returning p.* into result;

  -- No flip happened (not due, or not in an active-trial state): return as-is.
  if result.id is null then
    select p.* into result
    from public.profiles p
    where p.id = uid;
  end if;

  -- ── added: conversion-fix 1.2 ──────────────────────────────────────────
  -- getAccess() already calls this on every gated page, so stamping here costs
  -- no extra round trip. Throttled to one write per 15 minutes per user.
  -- (profiles' only UPDATE trigger is the cheap updated_at setter — checked
  -- 10 Sep 2026 — so this write has no side effects.)
  update public.profiles p
  set last_activity_at = now()
  where p.id = uid
    and (p.last_activity_at is null
         or p.last_activity_at < now() - interval '15 minutes');
  -- ── end added ──────────────────────────────────────────────────────────

  return result;
end;
$function$;


-- ─── 1.4  Activation timestamp ──────────────────────────────────────────────

alter table public.profiles
  add column if not exists tv_connected_at timestamptz;

comment on column public.profiles.tv_connected_at is
  'When the user FIRST saved a TradingView username. Set once in fn_set_tradingview_username, never overwritten. Null for users who connected before 2026-09-10 (no reliable backfill).';

-- LIVE body verbatim (identical to 20260806000001_tv_username_format.sql),
-- plus the marked additions.
create or replace function public.fn_set_tradingview_username(p_username text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid     uuid := (select auth.uid());
  cleaned text := nullif(btrim(p_username), '');
  result  public.profiles;
begin
  if uid is null then
    raise exception 'fn_set_tradingview_username: no authenticated user';
  end if;

  if cleaned is null then
    raise exception 'TradingView username cannot be empty';
  end if;

  if position('@' in cleaned) > 0 then
    raise exception 'That looks like an email — enter your TradingView username (the @handle), not your email';
  end if;

  if cleaned !~ '^[A-Za-z0-9_]{2,30}$' then
    raise exception 'Enter your TradingView username (the @handle) — letters, numbers and underscores only, not your display name';
  end if;

  update public.profiles p
  set tradingview_username = cleaned,
      -- added: conversion-fix 1.4 — first save only, never overwritten.
      tv_connected_at = coalesce(p.tv_connected_at, now())
  where p.id = uid
  returning p.* into result;

  if result.id is null then
    raise exception 'No profile found for the current user';
  end if;

  -- added: conversion-fix 1.3 — logged here so neither save site (indicators,
  -- strategies) can forget to emit it.
  perform public.fn_app_event_insert(uid, 'tv_username_set', '{}'::jsonb);

  return result;
end;
$$;

comment on function public.fn_set_tradingview_username(text) is
  'Own-row only: set the calling user''s tradingview_username (+ tv_connected_at on first save, + a tv_username_set event). Rejects emails / spaces / illegal chars (must be a TradingView @handle). SECURITY DEFINER because RLS has no user-write policy.';


-- ─── 1.5  Funnel read for /stats ────────────────────────────────────────────
-- Aggregated in the database: app_events outgrows PostgREST's 1000-row page
-- cap within days, and a paged fetch of raw events would be wasteful anyway.
--
-- Activation = TradingView connected AND Daily Analysis viewed, both within
-- 48h of signup. The cohort is signups old enough to have had the full 48h,
-- excluding grandfathered legacy members, and starting from the day the
-- signals began being recorded (neither tv_connected_at nor feature_view
-- existed before 10 Sep, so older signups would read as falsely unactivated).

create or replace function public.fn_admin_funnel_stats(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  days     integer     := greatest(1, least(coalesce(p_days, 30), 365));
  since    timestamptz := now() - make_interval(days => days);
  -- Neither activation signal existed before this instant.
  tracked  constant timestamptz := '2026-09-10 00:00:00+08';
  out      jsonb;
begin
  if not public.is_admin() then
    raise exception 'fn_admin_funnel_stats: admins only';
  end if;

  with cohort as (
    select p.id, p.signup_at, p.tv_connected_at, p.deposit_verified_at
    from public.profiles p
    where p.signup_at >= greatest(since, tracked)
      and p.signup_at <= now() - interval '48 hours'
      and not (p.account_status = 'member_active' and p.deposit_verified_at is null)
  ),
  flags as (
    select
      c.deposit_verified_at,
      (c.tv_connected_at is not null
        and c.tv_connected_at <= c.signup_at + interval '48 hours') as tv48,
      exists (
        select 1
        from public.app_events e
        where e.user_id = c.id
          and e.event = 'feature_view'
          and e.props ->> 'feature' = 'daily-analysis'
          and e.created_at <= c.signup_at + interval '48 hours'
      ) as da48
    from cohort c
  ),
  steps as (
    select e.event, count(distinct e.user_id) as users
    from public.app_events e
    where e.created_at >= since
      and e.event in (
        'upgrade_viewed',
        'upgrade_broker_link_clicked',
        'upgrade_contact_clicked',
        'deposit_verified'
      )
    group by e.event
  )
  select jsonb_build_object(
    'days',                   days,
    'cohort',                 (select count(*) from flags),
    'activated',              (select count(*) from flags where tv48 and da48),
    'tv48',                   (select count(*) from flags where tv48),
    'da48',                   (select count(*) from flags where da48),
    'activated_verified',     (select count(*) from flags
                                where tv48 and da48 and deposit_verified_at is not null),
    'not_activated_verified', (select count(*) from flags
                                where not (tv48 and da48) and deposit_verified_at is not null),
    'funnel',                 coalesce((select jsonb_object_agg(event, users) from steps),
                                       '{}'::jsonb)
  )
  into out;

  return out;
end;
$$;

revoke all on function public.fn_admin_funnel_stats(integer) from public, anon;
grant execute on function public.fn_admin_funnel_stats(integer) to authenticated;
