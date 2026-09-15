-- ============================================================================
-- Review queue: verify the amount the admin actually sees, and close a
-- submission without adding money (Gordon, 15 Sep).
--
-- Why: a member submitted $50.03, but the broker showed $159.32. The admin
-- recorded $159.32 by hand, and the queue then had no safe way to clear the
-- stale $50.03: Verify would ADD it on top, and Reject would email the member
-- that they weren't verified.
--
--   * verify takes an optional p_amount: the amount to verify, when it differs
--     from what the member typed. It goes through fn_verify_deposit as before
--     (every Phase 3 rule applies), and is kept in verified_amount.
--   * close marks the submission done with NO ledger entry, no email and no
--     notice for the member: for a deposit already recorded another way.
--
-- The function keeps its four argument names and gains a fifth with a default,
-- so the deployed app's 4-argument calls resolve to it unchanged. The old
-- signature is dropped in the same transaction, so there's no gap.
--
-- Additive for data: a wider status check and two nullable columns.
-- ============================================================================

alter table public.deposit_submissions drop constraint deposit_submissions_status_check;
alter table public.deposit_submissions add constraint deposit_submissions_status_check
  check (status in ('pending', 'verified', 'rejected', 'closed'));

alter table public.deposit_submissions
  add column if not exists verified_amount numeric(12,2),
  add column if not exists admin_note      text;

comment on column public.deposit_submissions.verified_amount is
  'The amount verified into the ledger, when the admin changed it from what the member submitted.';
comment on column public.deposit_submissions.admin_note is
  'Admin-only note: why a submission was closed, or that it was verified at a different amount. Never shown to the member.';


drop function public.fn_review_deposit_submission(uuid, text, text, boolean);

create function public.fn_review_deposit_submission(
  p_id           uuid,
  p_action       text,
  p_reason       text    default null,
  p_ib_confirmed boolean default false,
  p_amount       numeric default null
)
returns public.deposit_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  s        public.deposit_submissions;
  v_amount numeric;
begin
  if not public.is_admin() then
    raise exception 'fn_review_deposit_submission: admins only';
  end if;

  if p_action is null or p_action not in ('verify', 'reject', 'close') then
    raise exception 'Unknown review action %', p_action;
  end if;

  select * into s from public.deposit_submissions where id = p_id for update;
  if s.id is null then
    raise exception 'Submission not found';
  end if;
  if s.status <> 'pending' then
    raise exception 'This submission was already %', s.status;
  end if;

  if p_action = 'verify' then
    v_amount := round(coalesce(p_amount, s.amount), 2);
    if v_amount < 50 then
      raise exception 'The minimum deposit is $50';
    end if;

    -- All deposit rules live in fn_verify_deposit; it raises if any fail.
    perform public.fn_verify_deposit(s.user_id, s.broker, v_amount, p_ib_confirmed);

    update public.profiles p
    set trading_account_number = s.trading_account_number
    where p.id = s.user_id
      and p.trading_account_number is null;

    update public.deposit_submissions d
    set status          = 'verified',
        verified_amount = v_amount,
        admin_note      = case when v_amount <> s.amount
                               then format('Verified as $%s (submitted $%s)', v_amount, s.amount) end,
        reviewed_by     = (select auth.uid()),
        reviewed_at     = now()
    where d.id = p_id
    returning * into s;

  elsif p_action = 'reject' then
    if nullif(btrim(p_reason), '') is null then
      raise exception 'Give the member a reason for the rejection';
    end if;

    update public.deposit_submissions d
    set status = 'rejected', reject_reason = btrim(p_reason),
        reviewed_by = (select auth.uid()), reviewed_at = now()
    where d.id = p_id
    returning * into s;

  else  -- close: already recorded another way. No ledger entry, nothing for the member.
    update public.deposit_submissions d
    set status      = 'closed',
        admin_note  = coalesce(nullif(btrim(p_reason), ''), 'Closed: already recorded'),
        reviewed_by = (select auth.uid()),
        reviewed_at = now()
    where d.id = p_id
    returning * into s;
  end if;

  return s;
end;
$$;

revoke all on function public.fn_review_deposit_submission(uuid, text, text, boolean, numeric) from public, anon;
grant execute on function public.fn_review_deposit_submission(uuid, text, text, boolean, numeric) to authenticated;
