-- ============================================================================
-- Conversion-fix 5.2 — the admin review queue's one write path.
--
-- fn_review_deposit_submission(id, 'verify' | 'reject', reason, ib_confirmed):
--   * verify -> fn_verify_deposit with the submission's broker and amount, so
--     the $50 minimum, the partner-broker and IB checks, the ledger, the
--     cumulative total, top-ups and the double-submit guard all apply exactly
--     as in Phase 3. It also saves the submitted trading account number when
--     the profile has none: a member_active user without one is sent to the
--     dashboard gate on every page. It never overwrites an existing number.
--   * reject -> needs a reason, which the member sees on /upgrade.
--   Either way the submission must still be pending (row-locked), so two
--   admins can't review it twice.
-- Admin-only (is_admin() checked inside; auth.uid() stays the admin, so the
-- ledger row's verified_by is the reviewer).
-- ============================================================================

create or replace function public.fn_review_deposit_submission(
  p_id           uuid,
  p_action       text,
  p_reason       text    default null,
  p_ib_confirmed boolean default false
)
returns public.deposit_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.deposit_submissions;
begin
  if not public.is_admin() then
    raise exception 'fn_review_deposit_submission: admins only';
  end if;

  if p_action is null or p_action not in ('verify', 'reject') then
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
    -- All deposit rules live in fn_verify_deposit; it raises if any fail.
    perform public.fn_verify_deposit(s.user_id, s.broker, s.amount, p_ib_confirmed);

    update public.profiles p
    set trading_account_number = s.trading_account_number
    where p.id = s.user_id
      and p.trading_account_number is null;

    update public.deposit_submissions d
    set status = 'verified', reviewed_by = (select auth.uid()), reviewed_at = now()
    where d.id = p_id
    returning * into s;
  else
    if nullif(btrim(p_reason), '') is null then
      raise exception 'Give the member a reason for the rejection';
    end if;

    update public.deposit_submissions d
    set status = 'rejected', reject_reason = btrim(p_reason),
        reviewed_by = (select auth.uid()), reviewed_at = now()
    where d.id = p_id
    returning * into s;
  end if;

  return s;
end;
$$;

revoke all on function public.fn_review_deposit_submission(uuid, text, text, boolean) from public, anon;
grant execute on function public.fn_review_deposit_submission(uuid, text, text, boolean) to authenticated;
