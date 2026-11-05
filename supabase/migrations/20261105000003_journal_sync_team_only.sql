-- ============================================================================
-- After the trial, only Team MM syncs (Gordon, 5 Nov 2026).
-- 20261105000002 stopped syncing for lapsed owners; Foundation/Desk members
-- who connected during their trial still synced while locked out of the
-- assistant. fn_enqueue_due_sync_jobs now mirrors canAccess("ai-trading-
-- assistant") with accessTierFor (src/lib/access/features.ts, src/lib/tiers.ts):
--   * inside a running trial clock — trial, re-trial, or a member who
--     deposited mid-trial (accessTierFor keeps them on "trial")
--   * Team MM — member_active and grandfathered, a US/UK lifetime plan, or
--     cumulative deposits >= $500 (TIER_THRESHOLDS.team; a test pins this)
--   * an admin on a non-free tier (viewerRank)
-- Everything else stays connected but isn't queued; /journal tells them why
-- ("you're not on Team MM yet") and syncing resumes once they reach Team MM.
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
    join public.profiles p on p.id = a.user_id
    where a.state = 'deployed'
      and a.metaapi_account_id is not null
      and (a.last_synced_at is null or a.last_synced_at < now() - p_stale)
      and (
        (p.account_status in ('trial_active', 're_trial_active', 'member_active') and p.trial_ends_at > now())
        or (
          p.account_status = 'member_active'
          and (
            coalesce(p.grandfathered, false)
            or nullif(p.lifetime_plan, '') is not null
            or coalesce(p.deposit_amount, 0) >= 500
            or coalesce(p.is_admin, false)
          )
        )
      )
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
