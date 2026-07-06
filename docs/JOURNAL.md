# AI Trading Journal — Subsystem Guide

Phase 1 (Connect & Collect) of the AI Trading Journal. Full design:
`docs/superpowers/specs/2026-07-06-ai-trading-journal-design.md` · Plan:
`docs/superpowers/plans/2026-07-06-ai-trading-journal-phase1.md`

## How it works

1. Trader connects MT5 at `/journal/connect` — account number + **investor
   password** (read-only) + broker server. The password is passed through to
   MetaApi (cloud MT5 bridge) over TLS and **never stored or logged**; we keep
   only the returned `metaapi_account_id`.
2. A **job queue** (`journal_sync_jobs`) syncs each account incrementally:
   pg_cron POSTs `/api/journal/cron/sync` every 15 min → the worker enqueues
   due accounts (last sync > 4 h), claims jobs via `fn_claim_sync_jobs`
   (`FOR UPDATE SKIP LOCKED` — concurrency-safe), fetches new deals since the
   account's `sync_cursor`, and self-chains while backlog remains.
3. Raw deals land append-only in `journal_deals`; touched positions are
   rebuilt into `journal_trades` (round-trips) by the pure, unit-tested
   `reconstructTrades()`. `DEAL_TYPE_BALANCE` deals become
   `journal_cash_flows` (deposits/withdrawals — Phase 2 equity-curve math).
4. `/journal` shows account state, headline stats (`headlineStats()` — pure,
   tested) and the trade table. `journal_goals` (structured + free-text) is
   the benchmark the Phase 3 AI coach measures against.

## Files

| Area | Path |
|---|---|
| Schema + queue RPCs | `supabase/migrations/20260706000001_journal_core.sql` |
| Types | `src/lib/journal/types.ts` |
| Reconstruction (pure, TDD) | `src/lib/journal/reconstruct.ts` |
| Metrics (pure, TDD) | `src/lib/journal/metrics.ts` |
| MetaApi wrapper | `src/lib/journal/metaapi.ts` |
| Sync orchestrator | `src/lib/journal/sync.ts` |
| API guard/service helpers | `src/lib/journal/api.ts` |
| Routes | `src/app/api/journal/{accounts,goals,cron/sync}/…` |
| UI | `src/app/journal/…` |
| Apply script | `scripts/apply-journal-migration.mjs` |

## Operations

- **Env:** `METAAPI_TOKEN`, `METAAPI_REGION` (default `london`),
  `CRON_SECRET`, `NEXT_PUBLIC_APP_URL` (worker self-chaining).
- **Scheduler:** pg_cron + pg_net, snippet at the bottom of the migration
  file (same convention as `daily-growth-stats`). No Vercel cron slot used.
- **Retries:** transient sync failures re-queue with 5-min backoff, max 3
  attempts, then surface as `journal_accounts.sync_error` on the account card.
  Cursor only advances after successful writes — retries lose nothing.
- **Billing:** MetaApi charges per active account. Disconnect always attempts
  the MetaApi delete; rows with `state_detail = 'MetaApi cleanup pending'`
  need manual removal in the MetaApi dashboard.
- **Capacity dial:** `CLAIM_BATCH` / `CONCURRENCY` / chain depth in
  `src/app/api/journal/cron/sync/route.ts`. At defaults, comfortably serves
  hundreds of accounts on a 4 h cadence; thousands = raise the dials or add a
  second pg_cron tick — no architecture change.

## Phase roadmap

- **Phase 2 — See & Measure:** full analytics (DD, R:R, exposure, expectancy,
  streaks, per-symbol/session breakdowns), equity-curve dashboard, per-trade
  notes/tags/emotion UI (columns already exist).
- **Phase 3 — Understand & Coach:** daily AI report (Anthropic, follows the
  `growth/narrative.ts` pattern), habit detection, goal-relevance narrative,
  trade-management tips.
- **Broker Manager-API feed** (if brokers grant it) replaces MetaApi per-user
  connects by writing into the same `journal_deals` table — everything
  downstream is source-agnostic.
