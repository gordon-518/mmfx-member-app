-- ============================================================================
-- Conversion-fix Phase 7 — the measurement read for /stats.
--
-- fn_admin_measurement() is admin-only and returns one JSON object with the
-- plan's four views:
--   tier_cohorts   90-day cumulative deposits per acquired member, by ENTRY
--                  tier (the tier of their first verified deposit). Legacy
--                  (grandfathered) members are excluded, since they weren't
--                  acquired through the ladder. Members verified less than 90
--                  days ago count as "maturing" and are left out of the
--                  averages, so the numbers aren't dragged down by
--                  unfinished windows.
--   analysis_split Free-to-paid conversion for users who became Free since 10
--                  Sep (the day feature_view tracking started), split by
--                  whether they opened Daily Analysis after dropping to Free.
--   trial_cohorts  signup-to-deposit conversion within 30 days for the 7-day
--                  trial era (15 Jul to 10 Sep signups) and the 14-day era
--                  (10 Sep onward), counting only signups at least 30 days
--                  old. A younger cohort reports "so far" numbers instead.
--   weekly         for the last 8 signup weeks since tracking began, the share
--                  of signups that connected TradingView, and that activated
--                  (TradingView + Daily Analysis), within 48h.
-- Aggregated in the database: app_events is past PostgREST's 1000-row page
-- cap. Additive.
-- ============================================================================

create or replace function public.fn_admin_measurement()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tracked  constant timestamptz := '2026-09-10 00:00:00+08';  -- feature_view + tv_connected_at start
  era7_from constant timestamptz := '2026-07-15 00:00:00+08';  -- 7-day trial migration
  era14_from constant timestamptz := '2026-09-10 00:00:00+08'; -- 14-day trial migration
  out jsonb;
begin
  if not public.is_admin() then
    raise exception 'fn_admin_measurement: admins only';
  end if;

  with
  -- ── tier cohorts ──
  firsts as (
    select distinct on (e.user_id) e.user_id, e.amount as first_amount, e.verified_at as first_at
    from public.deposit_events e
    join public.profiles p on p.id = e.user_id
    where not p.grandfathered
    order by e.user_id, e.verified_at, e.id
  ),
  cohort90 as (
    select f.user_id,
           case when f.first_amount >= 500 then 'team'
                when f.first_amount >= 200 then 'desk'
                else 'foundation' end as entry_tier,
           f.first_at <= now() - interval '90 days' as mature,
           (select coalesce(sum(e.amount), 0) from public.deposit_events e
             where e.user_id = f.user_id and e.verified_at <= f.first_at + interval '90 days') as cum90
    from firsts f
  ),
  tiers as (
    select entry_tier,
           count(*)::int                                   as members,
           count(*) filter (where mature)::int             as mature,
           round(avg(cum90) filter (where mature), 2)      as avg_cum90,
           (percentile_cont(0.5) within group (order by cum90) filter (where mature))::numeric(12,2) as median_cum90
    from cohort90
    group by entry_tier
  ),
  -- ── Daily Analysis split, Free users since tracking ──
  frees as (
    select p.id, p.downgraded_at, p.deposit_verified_at
    from public.profiles p
    where p.downgraded_at >= tracked
      and not p.grandfathered
  ),
  split as (
    select exists (select 1 from public.app_events e
                   where e.user_id = f.id and e.event = 'feature_view'
                     and e.props ->> 'feature' = 'daily-analysis'
                     and e.created_at >= f.downgraded_at) as viewer,
           (f.deposit_verified_at is not null and f.deposit_verified_at >= f.downgraded_at) as converted
    from frees f
  ),
  -- ── trial eras ──
  eras as (
    select case when p.signup_at >= era14_from then '14-day' else '7-day' end as era,
           p.signup_at,
           p.deposit_verified_at
    from public.profiles p
    where p.signup_at >= era7_from
      and not p.grandfathered
  ),
  era_stats as (
    select era,
           count(*)::int as signups,
           count(*) filter (where signup_at <= now() - interval '30 days')::int as mature,
           count(*) filter (where signup_at <= now() - interval '30 days'
                              and deposit_verified_at is not null
                              and deposit_verified_at <= signup_at + interval '30 days')::int as converted30,
           count(*) filter (where deposit_verified_at is not null)::int as converted_so_far
    from eras
    group by era
  ),
  -- ── weekly activation + TV connection (signup weeks since tracking) ──
  weekly_base as (
    select date_trunc('week', p.signup_at at time zone 'Asia/Singapore')::date as week,
           p.signup_at,
           (p.tv_connected_at is not null and p.tv_connected_at <= p.signup_at + interval '48 hours') as tv48,
           exists (select 1 from public.app_events e
                   where e.user_id = p.id and e.event = 'feature_view'
                     and e.props ->> 'feature' = 'daily-analysis'
                     and e.created_at <= p.signup_at + interval '48 hours') as da48
    from public.profiles p
    where p.signup_at >= tracked
      and p.signup_at <= now() - interval '48 hours'
      and not p.grandfathered
  ),
  weekly as (
    select week,
           count(*)::int                              as signups,
           count(*) filter (where tv48)::int          as tv48,
           count(*) filter (where tv48 and da48)::int as activated
    from weekly_base
    group by week
    order by week desc
    limit 8
  )
  select jsonb_build_object(
    'tier_cohorts', coalesce((select jsonb_agg(to_jsonb(t) order by
                               case t.entry_tier when 'foundation' then 1 when 'desk' then 2 else 3 end)
                             from tiers t), '[]'::jsonb),
    'analysis_split', jsonb_build_object(
      'viewers',            (select count(*) from split where viewer),
      'viewers_converted',  (select count(*) from split where viewer and converted),
      'others',             (select count(*) from split where not viewer),
      'others_converted',   (select count(*) from split where not viewer and converted)
    ),
    'trial_cohorts', coalesce((select jsonb_agg(to_jsonb(e) order by e.era) from era_stats e), '[]'::jsonb),
    'weekly',        coalesce((select jsonb_agg(to_jsonb(w) order by w.week) from weekly w), '[]'::jsonb)
  ) into out;

  return out;
end;
$$;

revoke all on function public.fn_admin_measurement() from public, anon;
grant execute on function public.fn_admin_measurement() to authenticated;
