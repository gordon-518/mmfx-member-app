-- ============================================================================
-- Deposit submissions need a Telegram username (Gordon, 15 Sep), so the desk
-- can reach the member about their deposit (and Team MM invites) directly.
--
-- Adds deposit_submissions.telegram_username (nullable: the one pending
-- submission from before stays valid) and makes it REQUIRED for new
-- submissions: fn_submit_deposit gains p_telegram_username, created from its
-- current body (20260910000008) with only the marked changes. Grants are
-- restated.
--
-- Rollout: the old 5-argument function is NOT dropped here. Production keeps
-- calling it until this deploy is live, and PostgREST picks the overload that
-- matches the arguments sent, so both work during the window. A follow-up
-- migration drops the 5-argument version once the new code is deployed.
-- ============================================================================

alter table public.deposit_submissions
  add column if not exists telegram_username text
    check (telegram_username is null or telegram_username ~ '^[A-Za-z0-9_]{5,32}$');

comment on column public.deposit_submissions.telegram_username is
  'The member''s Telegram @handle, without the @. Required on new submissions (15 Sep).';

create or replace function public.fn_submit_deposit(
  p_broker                 text,
  p_trading_account_number text,
  p_amount                 numeric,
  p_tradingview_username   text,
  p_proof_path             text,
  p_telegram_username      text
)
returns public.deposit_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid     uuid := (select auth.uid());
  account text := nullif(btrim(p_trading_account_number), '');
  tv      text := nullif(btrim(p_tradingview_username), '');
  -- added (15 Sep): required, so the desk can reach the member. Stored without the @.
  tg      text := nullif(ltrim(btrim(p_telegram_username), '@'), '');
  result  public.deposit_submissions;
begin
  if uid is null then
    raise exception 'fn_submit_deposit: no authenticated user';
  end if;

  if p_broker is null or p_broker not in ('octa', 'dupoin', 'elev8') then
    raise exception 'Choose your broker: Octa, Dupoin or Elev8';
  end if;

  if account is null or account !~ '^[0-9]{4,20}$' then
    raise exception 'Enter your trading account number (digits only)';
  end if;

  if p_amount is null or p_amount < 50 then
    raise exception 'The minimum deposit is $50';
  end if;

  if tg is null or tg !~ '^[A-Za-z0-9_]{5,32}$' then
    raise exception 'Enter your Telegram username (the @handle, 5 to 32 letters, numbers or underscores)';
  end if;

  if tv is not null and tv !~ '^[A-Za-z0-9_]{2,30}$' then
    raise exception 'Enter your TradingView username (the @handle), or leave it blank';
  end if;

  -- The proof must be a file this user uploaded to their own folder.
  if p_proof_path is null
     or split_part(p_proof_path, '/', 1) <> uid::text
     or not exists (
       select 1 from storage.objects o
       where o.bucket_id = 'deposit-proofs' and o.name = p_proof_path
     ) then
    raise exception 'Upload a screenshot of your deposit';
  end if;

  if exists (
    select 1 from public.deposit_submissions s
    where s.user_id = uid and s.status = 'pending'
  ) then
    raise exception 'You already have a deposit waiting for review';
  end if;

  insert into public.deposit_submissions
    (user_id, broker, trading_account_number, amount, tradingview_username, proof_path, telegram_username)
  values
    (uid, p_broker, account, p_amount, tv, p_proof_path, tg)
  returning * into result;

  perform public.fn_app_event_insert(
    uid, 'deposit_submitted', jsonb_build_object('amount', p_amount, 'broker', p_broker)
  );

  return result;
end;
$$;

revoke all on function public.fn_submit_deposit(text, text, numeric, text, text, text) from public, anon;
grant execute on function public.fn_submit_deposit(text, text, numeric, text, text, text) to authenticated;
