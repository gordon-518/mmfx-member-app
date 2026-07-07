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
  `CRON_SECRET`, `NEXT_PUBLIC_APP_URL` (worker self-chaining), and
  `ANTHROPIC_API_KEY` (Phase 3 AI coach).
- **Scheduler:** two pg_cron + pg_net jobs — `journal-sync` (every 15 min) and
  `journal-report` (daily 22:30 UTC). Snippets at the bottom of each migration
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

- **Phase 1 — Connect & Collect: DONE.**
- **Phase 2 — See & Measure: DONE.** Analytics engine (`analytics.ts`), SVG
  charts (`charts.tsx`), rich KPI dashboard, per-trade notes/tags/emotion.
- **Phase 3 — Understand & Coach: DONE.** `coach.ts` (behavioural signals +
  prompt + Anthropic structured output, Haiku 4.5), `journal_reports` store,
  daily report cron (`/api/journal/cron/report`, self-chaining) + on-demand
  generation (`/api/journal/report/generate`), and the dashboard coach card.
- **Broker Manager-API feed** (if brokers grant it) replaces MetaApi per-user
  connects by writing into the same `journal_deals` table — everything
  downstream is source-agnostic.

## AI coach (Phase 3)

- Model: `claude-haiku-4-5` (constant in `coach.ts`) — cheap enough per-user
  daily at scale (~$0.005/report). Bump the constant for more depth.
- Report = summary + status (ahead/on_track/behind/at_risk) + good/bad habits
  + trade-management tips, judged against the user's `journal_goals`.
- Best-effort: a failed/absent model call returns null and never breaks a run.
- Seed/verify: `node scripts/seed-journal-report.mjs [email]` generates a real
  report from a user's data (also an end-to-end ANTHROPIC_API_KEY check).
