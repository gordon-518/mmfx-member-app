-- ============================================================================
-- Deposit form order + the 24-hour reminder (Gordon, 15 Sep).
--
-- The form now comes first; messaging Admin Amelia (@MM_3000) on Telegram is
-- the last step, shown once the submission is in. The desk shouldn't message
-- members first, so the app records when the member clicks "Message Admin
-- Amelia", and a member who hasn't clicked within 24 hours of submitting,
-- while the submission is still pending, gets ONE reminder email.
--
-- The app can't see the DM itself (a personal account), so the click is the
-- signal. The reminder is sent by /api/cron/deposit-dm-reminder, called hourly
-- by pg_cron job 'deposit-dm-reminder'.
--
-- Additive.
-- ============================================================================

alter table public.deposit_submissions
  add column if not exists admin_dm_clicked_at timestamptz,
  add column if not exists dm_reminder_sent_at timestamptz;

comment on column public.deposit_submissions.admin_dm_clicked_at is
  'When the member clicked "Message Admin Amelia" (fn_mark_submission_dm_clicked). The DM itself can''t be seen.';
comment on column public.deposit_submissions.dm_reminder_sent_at is
  'When the one 24-hour reminder email was claimed for sending (fn_claim_dm_reminders).';

-- The reminder job's scan: pending, not clicked, not yet reminded.
create index if not exists deposit_submissions_dm_reminder_idx
  on public.deposit_submissions (created_at)
  where status = 'pending' and admin_dm_clicked_at is null and dm_reminder_sent_at is null;


-- The member's click. Takes no arguments: it stamps the caller's own pending
-- submission (there is at most one), so nobody can mark anyone else's.
create or replace function public.fn_mark_submission_dm_clicked()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'fn_mark_submission_dm_clicked: no authenticated user';
  end if;

  update public.deposit_submissions
     set admin_dm_clicked_at = now()
   where user_id = uid
     and status = 'pending'
     and admin_dm_clicked_at is null;
end;
$$;

revoke all on function public.fn_mark_submission_dm_clicked() from public, anon;
grant execute on function public.fn_mark_submission_dm_clicked() to authenticated;


-- The reminder job's claim. Atomically stamps dm_reminder_sent_at on the due
-- rows and returns who to email, so overlapping runs can't double-send
-- (skip locked). Service role only.
create or replace function public.fn_claim_dm_reminders(p_limit integer default 50)
returns table (submission_id uuid, member_id uuid, email text, full_name text, amount numeric)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select s.id
      from public.deposit_submissions s
     where s.status = 'pending'
       and s.admin_dm_clicked_at is null
       and s.dm_reminder_sent_at is null
       and s.created_at <= now() - interval '24 hours'
       -- Only submissions made on the form-first flow. Older ones never had a
       -- "Message Admin Amelia" button to click, so they aren't emailed.
       and s.created_at >= timestamptz '2026-09-15 18:00:00+08'
     order by s.created_at
     limit greatest(1, least(coalesce(p_limit, 50), 200))
     for update skip locked
  ),
  claimed as (
    update public.deposit_submissions s
       set dm_reminder_sent_at = now()
      from due
     where s.id = due.id
    returning s.id, s.user_id, s.amount
  )
  select c.id, c.user_id, p.email, p.full_name, c.amount
    from claimed c
    join public.profiles p on p.id = c.user_id;
$$;

revoke all on function public.fn_claim_dm_reminders(integer) from public, anon, authenticated;
grant execute on function public.fn_claim_dm_reminders(integer) to service_role;
