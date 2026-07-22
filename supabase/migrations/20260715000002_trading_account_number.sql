-- Trading account number (MT4/MT5 login) — self-service field so inactive /
-- switched-account members can be filtered against broker data. Required for
-- member_active (gated in app); optional prompt for trials.

alter table public.profiles add column if not exists trading_account_number text;

comment on column public.profiles.trading_account_number is
  'The trader''s live MT4/MT5 account number (digits, 4-15 chars). Set only by fn_set_trading_account on the user''s own row. Used to filter inactive/switched-account members against broker data.';

-- Own-row setter. SECURITY DEFINER because RLS has no user-write policy.
-- Validation matches the client helper: digits only, length 4-15.
create or replace function public.fn_set_trading_account(p_number text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid     uuid := (select auth.uid());
  cleaned text := nullif(btrim(p_number), '');
  result  public.profiles;
begin
  if uid is null then
    raise exception 'fn_set_trading_account: no authenticated user';
  end if;

  if cleaned is null then
    raise exception 'Trading account number cannot be empty';
  end if;

  if cleaned !~ '^[0-9]{4,15}$' then
    raise exception 'Trading account number must be 4-15 digits';
  end if;

  update public.profiles p
  set trading_account_number = cleaned
  where p.id = uid
  returning p.* into result;

  if result.id is null then
    raise exception 'No profile found for the current user';
  end if;

  return result;
end;
$$;

comment on function public.fn_set_trading_account(text) is
  'Own-row only: set the calling user''s trading_account_number (4-15 digits). SECURITY DEFINER because RLS has no user-write policy.';

revoke execute on function public.fn_set_trading_account(text) from public, anon;
grant execute on function public.fn_set_trading_account(text) to authenticated;
