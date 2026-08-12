-- Security hardening: journal_accounts must be WRITE-ONLY via the service role.
--
-- The table carried Supabase's default GRANT ALL to `authenticated` plus
-- insert-own / update-own RLS policies. So a logged-in member could, via direct
-- PostgREST (bypassing the Next.js routes entirely), INSERT a row with
-- ib_review='ok' — skipping the connect route's IB-allowlist, blocked-account,
-- and trading-account checks — or UPDATE a flagged/blocked row's ib_review back
-- to 'ok', defeating the entire IB-attribution reconciliation. They could also
-- spoof mt5_login/broker_id/state/balance/equity into their own analytics.
--
-- The app sets user_id server-side and now routes the only two member-triggered
-- writes (connect upsert, disconnect update) through the service role, so members
-- never need direct write access. Reads stay member-scoped via the existing
-- journal_accounts_select_own policy; all other writes (sync worker, IB import,
-- ib-action) were already service-role-only.

revoke insert, update, delete on public.journal_accounts from authenticated, anon;

drop policy if exists journal_accounts_insert_own on public.journal_accounts;
drop policy if exists journal_accounts_update_own on public.journal_accounts;
-- journal_accounts_select_own is intentionally kept (member reads their own rows).
