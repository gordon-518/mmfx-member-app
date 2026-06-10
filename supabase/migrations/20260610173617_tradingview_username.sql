-- ============================================================================
-- Day 6 · Task 1 — capture the user's TradingView username.
--
-- Indicator access is granted manually on TradingView; first we need to
-- collect the username. RLS has no user-write policy (Day 3), so a client
-- UPDATE would be denied — the write goes through an own-row SECURITY DEFINER
-- function, the same pattern as fn_resolve_trial_status.
-- ============================================================================

alter table public.profiles
  add column tradingview_username text;

comment on column public.profiles.tradingview_username is
  'TradingView handle the user submitted to request indicator access. Set only by fn_set_tradingview_username on the user''s own row; granting access on TradingView is manual.';

-- ----------------------------------------------------------------------------
-- fn_set_tradingview_username — sets the CALLING user's own handle.
-- Trims, rejects empty, caps length. Own row only (where id = auth.uid()).
-- ----------------------------------------------------------------------------
create or replace function public.fn_set_tradingview_username(
  p_username text
)
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

  -- Generous upper bound — TradingView handles are short; this just stops
  -- abusive payloads, not legitimate names.
  if length(cleaned) > 100 then
    raise exception 'TradingView username is too long (max 100 characters)';
  end if;

  update public.profiles p
  set tradingview_username = cleaned
  where p.id = uid
  returning p.* into result;

  if result.id is null then
    raise exception 'No profile found for the current user';
  end if;

  return result;
end;
$$;

comment on function public.fn_set_tradingview_username(text) is
  'Own-row only: set the calling user''s tradingview_username (trimmed, non-empty, <=100 chars). SECURITY DEFINER because RLS has no user-write policy.';

-- Supabase default privileges grant EXECUTE to anon/authenticated on new
-- functions, so revoke-from-public alone is NOT enough to keep anon out —
-- revoke anon explicitly, then grant authenticated.
revoke execute on function public.fn_set_tradingview_username(text) from public, anon;
grant  execute on function public.fn_set_tradingview_username(text) to authenticated;
