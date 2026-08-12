-- Cost-hardening for member rollout (the "High cost items" from the stress test).

-- H1 — track consecutive connect failures. A wrong investor-password / server
-- account DEPLOYS fine but never CONNECTs, so it fails, is re-enqueued every 20h,
-- and re-deploys (a fresh 6-hour MetaApi billing block) forever. The worker now
-- escalates it to a terminal 'failed' state after a few tries; this column is the
-- persistent counter (job.attempts resets each enqueue, so it can't be used).
alter table public.journal_accounts
  add column if not exists connect_failures integer not null default 0;

-- H2 — at most ONE active (queued/running) job per account. The enqueue guard is
-- a check-then-insert with no constraint, so two overlapping invocations can both
-- insert, and two workers then run concurrent syncs of the same account. This
-- partial unique index makes that impossible.
create unique index if not exists journal_sync_jobs_one_active_per_account
  on public.journal_sync_jobs (account_id)
  where status in ('queued', 'running');

-- Enqueue must tolerate the new constraint under a race (the not-exists guard
-- still skips the common case; on-conflict handles the concurrent-insert race).
create or replace function public.fn_enqueue_due_sync_jobs(p_stale interval)
returns integer
language sql
security definer
set search_path = public
as $$
  with due as (
    insert into public.journal_sync_jobs (account_id)
    select a.id
    from public.journal_accounts a
    where a.state = 'deployed'
      and a.metaapi_account_id is not null
      and (a.last_synced_at is null or a.last_synced_at < now() - p_stale)
      and not exists (
        select 1 from public.journal_sync_jobs j
        where j.account_id = a.id and j.status in ('queued','running')
      )
    on conflict do nothing
    returning 1
  )
  select coalesce(count(*), 0)::integer from due;
$$;
revoke execute on function public.fn_enqueue_due_sync_jobs(interval) from public, anon, authenticated;

-- Finding 3 — atomic per-user daily report reservation. The old cap was a
-- non-atomic read-then-write, so N parallel POSTs each passed the check and each
-- burned an Anthropic call. Reserve a slot BEFORE the model call; refund on
-- failure. Service-role only (the route passes the caller's id).
create or replace function public.fn_reserve_journal_report(p_user uuid, p_cap integer)
returns integer  -- new gen_count, or NULL when the daily cap is already reached
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  insert into public.journal_reports (user_id, report_date, summary, gen_count)
  values (p_user, (now() at time zone 'utc')::date, '', 1)
  on conflict (user_id, report_date) do update
    set gen_count = public.journal_reports.gen_count + 1
    where public.journal_reports.gen_count < p_cap
  returning gen_count into n;
  return n;
end;
$$;
revoke execute on function public.fn_reserve_journal_report(uuid, integer) from public, anon, authenticated;

create or replace function public.fn_refund_journal_report(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.journal_reports
    set gen_count = greatest(0, gen_count - 1)
    where user_id = p_user and report_date = (now() at time zone 'utc')::date;
  -- drop a placeholder reservation row that never received real content
  delete from public.journal_reports
    where user_id = p_user and report_date = (now() at time zone 'utc')::date
      and gen_count <= 0 and summary = '';
end;
$$;
revoke execute on function public.fn_refund_journal_report(uuid) from public, anon, authenticated;
