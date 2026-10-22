-- ============================================================================
-- Start here, rebuilt (22 Oct) — the public Telegram channel becomes step 1.
--
-- Joining a Telegram channel happens on Telegram's side, so the app cannot
-- verify membership. It records the click-through, the same honest limit as
-- the deposit DM (see src/lib/depositRef.ts): the member opened the channel.
--
--   * fn_log_event accepts the 'telegram' checklist step from the browser.
--   * fn_my_onboarding returns it, first, for the /welcome roadmap.
--   * fn_onboarding_states counts it, so the SendPulse day-N emails see the
--     same six steps the member sees. NOTE: onboarding_done now tops out at 6,
--     not 5 — any automation testing "= 5" for finished needs 6.
--
-- All three functions are re-created from their current bodies
-- (20260910000007 / 20260915000002) with only the marked changes. Grants are
-- restated because they are part of each function's contract.
-- ============================================================================

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

  -- changed (22 Oct): 'telegram' joins 'lesson-1' as a step the browser may
  -- mark. Still an allowlist, so the client cannot invent keys.
  if p_event = 'onboarding_step_done'
     and coalesce(p_props ->> 'step', '') not in ('lesson-1', 'telegram') then
    raise exception 'fn_log_event: unknown onboarding step';
  end if;

  perform public.fn_app_event_insert(uid, p_event, p_props);
end;
$$;

revoke all on function public.fn_log_event(text, jsonb) from public, anon;
grant execute on function public.fn_log_event(text, jsonb) to authenticated;


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
    return jsonb_build_object('telegram', false, 'tv', false, 'analysis', false,
                              'kys', false, 'lesson1', false, 'desk', false);
  end if;

  return jsonb_build_object(
    -- added (22 Oct): the member opened the public channel from /welcome.
    'telegram', exists (select 1 from public.app_events e
                        where e.user_id = uid and e.event = 'onboarding_step_done'
                          and e.props ->> 'step' = 'telegram'),
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


create or replace function public.fn_onboarding_states()
returns table (user_id uuid, steps text, done integer)
language sql
stable
security definer
set search_path = ''
as $$
  with ev as (
    select e.user_id,
           bool_or(e.event = 'feature_view' and e.props ->> 'feature' = 'daily-analysis') as analysis,
           bool_or(e.event = 'onboarding_step_done' and e.props ->> 'step' = 'telegram')  as telegram,
           bool_or(e.event = 'onboarding_step_done' and e.props ->> 'step' = 'lesson-1')  as lesson1,
           bool_or(e.event = 'upgrade_viewed')                                          as desk
    from public.app_events e
    where e.event in ('feature_view', 'onboarding_step_done', 'upgrade_viewed')
    group by e.user_id
  ),
  s as (
    select p.id,
           coalesce(ev.telegram, false)        as telegram,
           p.tradingview_username is not null  as tv,
           coalesce(ev.analysis, false)        as analysis,
           p.kys_completed_at is not null      as kys,
           coalesce(ev.lesson1, false)         as lesson1,
           coalesce(ev.desk, false)            as desk
    from public.profiles p
    left join ev on ev.user_id = p.id
  )
  select s.id,
         concat_ws(',',
           case when s.telegram then 'telegram' end,
           case when s.tv       then 'tv'       end,
           case when s.analysis then 'analysis' end,
           case when s.kys      then 'kys'      end,
           case when s.lesson1  then 'lesson1'  end,
           case when s.desk     then 'desk'     end),
         (s.telegram::int + s.tv::int + s.analysis::int + s.kys::int + s.lesson1::int + s.desk::int)
  from s;
$$;

revoke all on function public.fn_onboarding_states() from public, anon, authenticated;
grant execute on function public.fn_onboarding_states() to service_role;
