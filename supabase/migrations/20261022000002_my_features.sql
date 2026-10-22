-- ============================================================================
-- Start here, part 2 (22 Oct) — "which of the desk's tools have I opened?"
--
-- requireFeature logs a feature_view for every GRANTED page view (1.3), so the
-- answer already exists in app_events; members just can't read that table.
-- This is the same own-row, security-definer shape as fn_my_onboarding.
--
-- Returns a jsonb array of distinct feature keys, e.g. ["course","signals"].
-- Caller-scoped: auth.uid() only, never another member's.
-- ============================================================================

create or replace function public.fn_my_features()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'fn_my_features: no authenticated user';
  end if;

  return coalesce(
    (select jsonb_agg(distinct e.props ->> 'feature')
       from public.app_events e
      where e.user_id = uid
        and e.event = 'feature_view'
        and e.props ->> 'feature' is not null),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.fn_my_features() from public, anon;
grant execute on function public.fn_my_features() to authenticated;
