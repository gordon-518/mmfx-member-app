-- ============================================================================
-- Conversion-fix Phase 4 — guided onboarding.
--
--   * onboarding_step_done joins the app_events allowlist (plan 1.3 named it
--     for a later phase). It's browser-originated (the course player marks
--     lesson 1), so fn_log_event accepts it too, and it's deduped per step: a
--     user who rewatches lesson 1 doesn't pile up rows.
--   * fn_my_onboarding() returns the caller's own five checklist steps.
--     Users can't read app_events (admin-only), so this security-definer
--     read derives progress for auth.uid() only.
--
-- The two event functions are re-created from their current bodies
-- (fn_app_event_insert from 20260910000006, fn_log_event from
-- 20260910000002) with only the marked changes. Grants are restated because
-- they're part of each function's contract.
-- ============================================================================

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
    'onboarding_step_done'   -- added (Phase 4)
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

  -- added (Phase 4): a checklist step is done once; later repeats are no-ops.
  if p_event = 'onboarding_step_done' and exists (
    select 1
    from public.app_events e
    where e.user_id = p_user_id
      and e.event = 'onboarding_step_done'
      and e.props ->> 'step' = v_props ->> 'step'
  ) then
    return;
  end if;

  insert into public.app_events (user_id, event, props)
  values (p_user_id, p_event, v_props);
end;
$$;

revoke all on function public.fn_app_event_insert(uuid, text, jsonb)
  from public, anon, authenticated;


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
    'onboarding_step_done'   -- added (Phase 4): the course player marks lesson 1
  ) then
    raise exception 'fn_log_event: % cannot be logged from the client', p_event;
  end if;

  -- added (Phase 4): only known checklist steps, so the client can't invent keys.
  if p_event = 'onboarding_step_done'
     and coalesce(p_props ->> 'step', '') not in ('lesson-1') then
    raise exception 'fn_log_event: unknown onboarding step';
  end if;

  perform public.fn_app_event_insert(uid, p_event, p_props);
end;
$$;

revoke all on function public.fn_log_event(text, jsonb) from public, anon;
grant execute on function public.fn_log_event(text, jsonb) to authenticated;


-- The caller's own checklist. Each step is read from where it actually
-- happens, not from separate bookkeeping:
--   tv        a TradingView username is saved. The username, not
--             tv_connected_at: that stamp only exists from 10 Sep, and the
--             368 users who connected earlier would read as not done.
--   analysis  a Daily Analysis feature_view (recorded since 10 Sep)
--   kys       Know Your Style completed
--   lesson1   the course player marked Module 1, lesson 1
--   desk      the upgrade page (the tier prompt) was viewed
create or replace function public.fn_my_onboarding()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  p   public.profiles;
begin
  if uid is null then
    raise exception 'fn_my_onboarding: no authenticated user';
  end if;

  select * into p from public.profiles where id = uid;
  if p.id is null then
    return jsonb_build_object('tv', false, 'analysis', false, 'kys', false, 'lesson1', false, 'desk', false);
  end if;

  return jsonb_build_object(
    'tv',       p.tradingview_username is not null,
    'analysis', exists (select 1 from public.app_events e
                        where e.user_id = uid and e.event = 'feature_view'
                          and e.props ->> 'feature' = 'daily-analysis'),
    'kys',      p.kys_completed_at is not null,
    'lesson1',  exists (select 1 from public.app_events e
                        where e.user_id = uid and e.event = 'onboarding_step_done'
                          and e.props ->> 'step' = 'lesson-1'),
    'desk',     exists (select 1 from public.app_events e
                        where e.user_id = uid and e.event = 'upgrade_viewed')
  );
end;
$$;

revoke all on function public.fn_my_onboarding() from public, anon;
grant execute on function public.fn_my_onboarding() to authenticated;
