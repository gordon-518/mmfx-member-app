-- ============================================================================
-- Conversion-fix 5.5 — the hot-leads list for manual WhatsApp follow-up.
--
-- A hot lead has:
--   * hit the activation milestone: TradingView connected (username saved)
--     and Daily Analysis viewed. The working list drops the 48h window that
--     the /stats activation metric uses: any time counts here.
--   * 3+ sessions. The app doesn't record sessions, so this counts DISTINCT
--     DAYS with any app event (feature views, upgrade views, clicks). That's
--     a stable proxy that doesn't inflate on refreshes.
--   * viewed /upgrade but never submitted a deposit, and isn't a paying member.
-- Ordered by most recent activity. Admin-only; returns rows, not a table.
-- ============================================================================

create or replace function public.fn_admin_hot_leads(p_limit integer default 200)
returns table (
  user_id        uuid,
  email          text,
  full_name      text,
  country        text,
  account_status text,
  signup_at      timestamptz,
  active_days    integer,
  upgrade_views  integer,
  last_seen      timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'fn_admin_hot_leads: admins only';
  end if;

  return query
  with activity as (
    select e.user_id,
           count(distinct (e.created_at at time zone 'Asia/Singapore')::date)::int as active_days,
           count(*) filter (where e.event = 'upgrade_viewed')::int                 as upgrade_views,
           bool_or(e.event = 'feature_view' and e.props ->> 'feature' = 'daily-analysis') as saw_analysis,
           max(e.created_at)                                                       as last_seen
    from public.app_events e
    group by e.user_id
  )
  select p.id, p.email, p.full_name, p.country, p.account_status, p.signup_at,
         a.active_days, a.upgrade_views, greatest(a.last_seen, p.last_activity_at)
  from activity a
  join public.profiles p on p.id = a.user_id
  where p.tradingview_username is not null
    and a.saw_analysis
    and a.active_days >= 3
    and a.upgrade_views > 0
    and p.account_status <> 'member_active'
    and not coalesce(p.is_admin, false)
    and not exists (select 1 from public.deposit_submissions s where s.user_id = p.id)
  order by greatest(a.last_seen, p.last_activity_at) desc nulls last
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
end;
$$;

revoke all on function public.fn_admin_hot_leads(integer) from public, anon;
grant execute on function public.fn_admin_hot_leads(integer) to authenticated;
