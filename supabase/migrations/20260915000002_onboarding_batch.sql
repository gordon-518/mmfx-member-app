-- ============================================================================
-- Conversion-fix 4.3 follow-up — onboarding progress for the SendPulse sync.
--
-- The day 1–5 onboarding emails ("step N not done by day N") are built in
-- SendPulse, which only sees what the nightly sync stamps on each contact.
-- fn_onboarding_states() returns every profile's done steps as a
-- comma-separated list (tv, analysis, kys, lesson1, desk). Each step is read
-- the same way as fn_my_onboarding (20260910000007), with one query for
-- everyone instead of one per user.
--
-- service_role ONLY: the sync runs with the service key, and a browser must
-- never read other users' progress.
-- ============================================================================

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
           bool_or(e.event = 'onboarding_step_done' and e.props ->> 'step' = 'lesson-1')  as lesson1,
           bool_or(e.event = 'upgrade_viewed')                                          as desk
    from public.app_events e
    where e.event in ('feature_view', 'onboarding_step_done', 'upgrade_viewed')
    group by e.user_id
  ),
  s as (
    select p.id,
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
           case when s.tv       then 'tv'       end,
           case when s.analysis then 'analysis' end,
           case when s.kys      then 'kys'      end,
           case when s.lesson1  then 'lesson1'  end,
           case when s.desk     then 'desk'     end),
         (s.tv::int + s.analysis::int + s.kys::int + s.lesson1::int + s.desk::int)
  from s;
$$;

revoke all on function public.fn_onboarding_states() from public, anon, authenticated;
grant execute on function public.fn_onboarding_states() to service_role;
