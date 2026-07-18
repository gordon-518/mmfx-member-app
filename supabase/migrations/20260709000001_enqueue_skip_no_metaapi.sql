-- ============================================================================
-- Only enqueue sync jobs for accounts that actually have a MetaApi id. An
-- account with no metaapi_account_id (e.g. the seeded demo account, or a
-- provisioning failure) can never sync, so scheduling it just churns failed
-- jobs and puts a spurious sync_error on the dashboard.
-- ============================================================================

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
    returning 1
  )
  select coalesce(count(*), 0)::integer from due;
$$;

revoke execute on function public.fn_enqueue_due_sync_jobs(interval) from public, anon, authenticated;
