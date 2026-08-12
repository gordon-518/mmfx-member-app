-- Defense-in-depth: reject malformed TradingView usernames at the DB layer too.
-- People paste their email or their display name (with spaces) instead of the
-- @username, so the grant goes nowhere and the indicators appear "broken"
-- (novamase / "Dcmase" ticket, 2026-08). Mirrors src/lib/tvUsername.ts.

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
  'Own-row only: set the calling user''s tradingview_username. Rejects emails / spaces / illegal chars (must be a TradingView @handle). SECURITY DEFINER because RLS has no user-write policy.';
