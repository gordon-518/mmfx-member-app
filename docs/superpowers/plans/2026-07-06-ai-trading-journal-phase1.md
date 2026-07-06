# AI Trading Journal — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MT5 connect (MetaApi, investor password pass-through), queued incremental sync into a source-agnostic Postgres model, trade reconstruction, goals onboarding, and a basic /journal dashboard.

**Architecture:** Raw-SQL migration adds five `journal_*` tables + queue RPCs (`FOR UPDATE SKIP LOCKED`). Pure TypeScript libs (`reconstruct`, `metrics`) are TDD'd with Vitest. A thin no-SDK MetaApi wrapper and a `syncAccount` orchestrator run inside a pg_cron-triggered worker route that claims → processes → self-chains. UI follows existing gated-page patterns (`getAccess`, AppShell).

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS + pg_cron/pg_net), Vitest, raw fetch to MetaApi.

**Spec:** `docs/superpowers/specs/2026-07-06-ai-trading-journal-design.md`

---

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/20260706000001_journal_core.sql` | Tables, RLS, indexes, queue RPCs |
| `src/lib/journal/types.ts` | Shared row/deal types |
| `src/lib/journal/reconstruct.ts` (+ `.test.ts`) | Deals → trades/cash-flows (pure) |
| `src/lib/journal/metrics.ts` (+ `.test.ts`) | Headline stats (pure) |
| `src/lib/journal/metaapi.ts` | MetaApi REST wrapper (server-only) |
| `src/lib/journal/sync.ts` | Per-account sync orchestration (deps injected, testable) |
| `src/app/api/journal/accounts/route.ts` | POST connect |
| `src/app/api/journal/accounts/[id]/route.ts` | DELETE disconnect |
| `src/app/api/journal/accounts/[id]/sync/route.ts` | POST manual sync |
| `src/app/api/journal/goals/route.ts` | GET/PUT goals |
| `src/app/api/journal/cron/sync/route.ts` | Worker: enqueue, claim, process, self-chain |
| `src/app/journal/page.tsx` (+ components) | Dashboard (server) + client cards/table |
| `src/app/journal/connect/page.tsx` (+ wizard) | Connect + goals wizard |
| `src/components/AppShell.tsx` | Nav entry |
| `.env.example`, `docs/SCHEMA.md` | Env + schema docs |
| `scripts/apply-journal-migration.mjs` | Apply migration via DATABASE_URL (mirrors apply-growth-migration.mjs) |

### Task 1: Migration `journal_core.sql`
- [x] Write full SQL: 5 tables per spec §Data model, RLS (`user_id = auth.uid()` select/insert/update/delete where applicable; deals/cash_flows/jobs are service-role-write, user-read via account join), indexes, `fn_enqueue_due_sync_jobs(p_stale interval)`, `fn_claim_sync_jobs(p_limit int)` (security definer, SKIP LOCKED), pg_cron snippet comment.
- [x] Commit.

### Task 2: types.ts
- [x] `MetaApiDeal`, `JournalTrade`, `CashFlow`, `JournalAccountRow`, deal type/entry unions. Commit with Task 3.

### Task 3: reconstruct.ts (TDD)
- [x] Failing tests: simple buy round-trip; sell; partial close (stays one open trade w/ realized profit); fully-closed multi-entry VWAP; INOUT reversal closes position; out-of-order deals; balance deals → cash flows; unknown/zero-volume deals ignored.
- [x] Run: `npm test -- reconstruct` → FAIL. Implement `reconstructTrades(deals: MetaApiDeal[]): { trades, cashFlows }`. Run → PASS. Commit.

### Task 4: metrics.ts (TDD)
- [x] Failing tests: netProfit, winRate (closed only, excludes break-even from wins), tradeCount, profitFactor (gross win / gross loss; null when no losses), empty input. Implement `headlineStats(trades)`. PASS. Commit.

### Task 5: metaapi.ts
- [x] `createMetaApiAccount({login,password,server,name})`, `getMetaApiAccount(id)`, `deleteMetaApiAccount(id)`, `fetchDealsByTimeRange(accountId, start, end, offset)` (paginate ≤1000), `fetchAccountInformation(accountId)`. Hosts per spec; headers `auth-token`; 15s timeout via AbortSignal; typed errors `MetaApiError{status,message}`. Never log password. Commit.

### Task 6: sync.ts (TDD on cursor logic)
- [x] `syncAccount(db, account, api)` — fetch deals from `sync_cursor ?? epoch` to now (+60s overlap guard), upsert deals, reconstruct **all deals of touched positions** (fetch existing rows for those position_ids from journal_deals so partial history merges correctly), upsert trades + cash flows, refresh balance/equity, advance cursor to max deal time. Pure helper `nextCursor(deals, prev)` tested. Commit.

### Task 7: API routes
- [x] Per spec §API surface. Auth via `getAccess()` fail-closed; cron via `CRON_SECRET`; service-role client only in cron; manual-sync rate limit 5 min via last job lookup. Self-chain depth cap 5, batch 25, concurrency 5, `maxDuration = 300`. Commit per route group.

### Task 8: UI
- [x] `/journal` server page → `getAccess()` gate (mirror existing gated pages), fetch own accounts/trades/goals, render `JournalDashboard` (client): account card w/ state chip, Sync now, Disconnect confirm; headline stat tiles; trades table (paginated 25, closed) + open positions strip; goals summary + edit link; empty→connect CTA.
- [x] `/journal/connect` client wizard: step 1 creds (login/password/server/label, investor-password reassurance copy), POST, handle `connecting|failed`; step 2 goals form (skippable). Redirect `/journal`.
- [x] AppShell nav "Trading Journal". Commit.

### Task 9: Env, docs, apply script
- [x] `.env.example` += `METAAPI_TOKEN`, `METAAPI_REGION`, `CRON_SECRET`; SCHEMA.md journal section; `scripts/apply-journal-migration.mjs`. Commit.

### Task 10: Verify
- [x] `npm test` all green; `npm run build` clean; apply migration; smoke-check RLS via anon select. Commit any fixes.
