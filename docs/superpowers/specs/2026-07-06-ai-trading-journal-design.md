# AI Trading Journal — Design

**Date:** 2026-07-06
**Status:** Approved (brainstormed with Gordon; phasing + architecture choices confirmed)

## What we're building

An AI Trading Journal inside the MMFX member app. Traders connect their MT5
account (account number + **investor password** — read-only), the system pulls
their trade history automatically, computes analytics (drawdown, R:R,
exposure), detects habits, and produces a daily AI-written report measured
against the trader's stated goals.

### Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| Data source | Live per-user MT5 connect via **MetaApi** (cloud MT5 bridge). Broker Manager-API feed may replace it later — ingestion is source-agnostic. |
| Product type | Auto-analytics + **light notes** (note/tags/emotion per trade; AI reads them). |
| Goals capture | **Structured fields + free-text** ("what I'm working on"). The AI's benchmark. |
| Pipeline | Simple cron for math + AI; **job queue for the MT5 sync only** (the one stage that breaks at thousands of users). |
| Scale target | Hundreds now → thousands later, no re-architecture. |

## Phases

- **Phase 1 — Connect & Collect** (this spec, in detail): MetaApi connect flow,
  queued sync pipeline, source-agnostic data model, trade reconstruction,
  goals onboarding, basic dashboard (headline stats + trade table).
- **Phase 2 — See & Measure**: full analytics engine (DD, R:R, exposure,
  expectancy, streaks, breakdowns), real dashboard (equity curve, DD chart),
  per-trade notes/tags/emotion UI + screenshots.
- **Phase 3 — Understand & Coach**: daily AI report cron, habit detection,
  goal-relevance narrative, trade-management tips, on-demand "explain this".

Each phase is a separate spec → plan → build cycle. Phase 1 schema already
carries the columns Phases 2–3 need (notes fields, cash-flow rows) so no
migration churn later.

## Architecture (Phase 1)

```
Trader ──▶ /journal/connect ──▶ POST /api/journal/accounts
                                   │  (validates, provisions account at MetaApi
                                   │   with login+investor password — password is
                                   │   PASSED THROUGH, never stored by us)
                                   ▼
                            journal_accounts row (stores metaapi_account_id)
                                   │ enqueue initial sync
                                   ▼
        pg_cron (every 15 min) ──▶ POST /api/journal/cron/sync  [CRON_SECRET]
                                   │ 1. enqueue jobs for accounts due a sync
                                   │ 2. claim up to N jobs (FOR UPDATE SKIP LOCKED)
                                   │ 3. per job: fetch new deals from MetaApi
                                   │    since cursor → upsert journal_deals →
                                   │    rebuild journal_trades for touched
                                   │    positions → advance cursor
                                   │ 4. self-chain if queue not empty
                                   ▼
                     journal_deals (raw, immutable)  ──▶  journal_trades
                                                          (reconstructed
                                                           round-trips)
                                   ▼
                        /journal dashboard (RLS: own rows only)
```

### Why this shape scales

- **The queue protects the only slow stage.** Fetching from MetaApi is a
  network call per account. Jobs are individually claimed, retried on failure
  (max 3 attempts), and processed in small concurrent batches — no single
  run ever has to finish "all accounts" to succeed.
- **Claiming uses `FOR UPDATE SKIP LOCKED`** via a `security definer` RPC, so
  any number of worker invocations can run concurrently without double-
  processing an account.
- **Incremental sync.** Each account has a `sync_cursor` (last deal time
  fetched). A sync fetches only deals after the cursor — cost per sync stays
  constant regardless of account age.
- **Math is pure functions** on our own Postgres rows (instant at this scale);
  AI (Phase 3) is one batched daily call per user — cheap, queueable later
  if ever needed.
- **Source-agnostic core.** `journal_deals`/`journal_trades` know nothing
  about MetaApi. A broker Manager-API feed (if brokers grant it) becomes just
  another writer into the same tables.

## Data model (one migration: `journal_core.sql`)

All tables RLS-enabled: users SELECT/modify own rows via `user_id = auth.uid()`;
the sync worker uses the service role (server-only).

**`journal_accounts`** — one row per connected MT5 account
- `id uuid pk`, `user_id uuid fk auth.users`, `label text`
- `mt5_login text`, `broker_server text` (display/reference only)
- `metaapi_account_id text unique` — the only credential-adjacent thing we keep
- `state text` — `connecting | deployed | failed | disconnected`
- `state_detail text` — human-readable error/status from MetaApi
- `balance numeric`, `equity numeric`, `currency text` — cached snapshot
- `sync_cursor timestamptz` — last deal time ingested
- `last_synced_at timestamptz`, `sync_error text`
- `created_at`, `disconnected_at`
- Unique `(user_id, mt5_login, broker_server)` — no duplicate connects.

**`journal_deals`** — raw MT5 deals, append-only source of truth
- `id uuid pk`, `account_id fk journal_accounts on delete cascade`
- `deal_id text` (MetaApi/MT5 deal id), unique `(account_id, deal_id)` — upsert-idempotent
- `position_id text`, `order_id text`, `symbol text`
- `type text` (`DEAL_TYPE_BUY | DEAL_TYPE_SELL | DEAL_TYPE_BALANCE | ...`)
- `entry_type text` (`DEAL_ENTRY_IN | DEAL_ENTRY_OUT | DEAL_ENTRY_INOUT | DEAL_ENTRY_OUT_BY`)
- `volume numeric`, `price numeric`, `profit numeric`, `commission numeric`, `swap numeric`
- `time timestamptz`, `broker_time text`, `magic bigint`, `comment text`
- Index `(account_id, position_id)`, `(account_id, time)`.

**`journal_trades`** — reconstructed round-trips (what the UI/AI reads)
- `id uuid pk`, `account_id fk`, `user_id uuid` (denormalized for RLS + fast per-user queries)
- `position_id text`, unique `(account_id, position_id)` — rebuild-idempotent
- `symbol text`, `direction text` (`buy | sell`), `status text` (`open | closed`)
- `volume numeric` (total entered), `open_price numeric` (VWAP of entries),
  `close_price numeric` (VWAP of exits, null while open)
- `open_time timestamptz`, `close_time timestamptz`
- `profit numeric`, `commission numeric`, `swap numeric`, `net_profit numeric`
- `duration_sec integer`
- Phase-2-ready: `note text`, `tags text[]`, `emotion text`
- Index `(user_id, close_time desc)`, `(account_id, status)`.

**`journal_cash_flows`** — deposits/withdrawals (from `DEAL_TYPE_BALANCE` deals)
- `id uuid pk`, `account_id fk`, `deal_id text` unique `(account_id, deal_id)`
- `amount numeric`, `time timestamptz`, `comment text`
- Needed for correct equity-curve/drawdown math in Phase 2.

**`journal_goals`** — the AI's benchmark, one row per user
- `user_id uuid pk fk auth.users`
- Structured: `style text` (`scalper | day | swing | position`),
  `account_size numeric`, `monthly_target_pct numeric`,
  `max_drawdown_pct numeric`, `risk_per_trade_pct numeric`,
  `instruments text[]`
- Free-text: `focus_text text` ("what I'm working on right now")
- `updated_at timestamptz`

**`journal_sync_jobs`** — the queue
- `id bigint identity pk`, `account_id fk`, `status text`
  (`queued | running | done | failed`), `attempts int default 0`,
  `scheduled_at timestamptz`, `started_at`, `finished_at`, `error text`
- Partial index on `(status, scheduled_at)` where status = 'queued'.
- `fn_enqueue_due_sync_jobs(interval)` — inserts queued jobs for deployed
  accounts whose last sync is older than the interval and that have no
  queued/running job (no pile-up).
- `fn_claim_sync_jobs(n int)` — `security definer`; marks up to n queued jobs
  `running` using `FOR UPDATE SKIP LOCKED` and returns them.
- Retry: worker marks `failed` with error; a failed job with attempts < 3 is
  re-enqueued by the next `fn_enqueue_due_sync_jobs` pass. After 3 failures the
  account's `sync_error` is set and shown in the UI.

## MetaApi integration (`src/lib/journal/metaapi.ts`)

Raw `fetch`, matching the codebase's no-SDK convention. Server-only.

- **Provision:** `POST https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts`
  headers `auth-token: METAAPI_TOKEN`, `transaction-id: <32 random chars>`;
  body `{ name, login, password, server, platform: "mt5", magic: 0, region }`.
  201/202 → `{ id, state }`. The investor password goes MetaApi-ward only.
- **Read state:** `GET .../users/current/accounts/:id` (provisioning host).
- **Remove:** `DELETE .../users/current/accounts/:id` on disconnect.
- **Deals:** `GET https://mt-client-api-v1.{region}.agiliumtrade.ai/users/current/accounts/:accountId/history-deals/time/:startTime/:endTime?offset&limit`
  (limit ≤ 1000 → paginate).
- **Account info:** `GET .../users/current/accounts/:accountId/account-information`
  → balance/equity/currency snapshot.
- Env: `METAAPI_TOKEN`, `METAAPI_REGION` (default `london`).
- All calls: typed thin wrappers, timeouts, descriptive errors. No retries in
  the wrapper — the job queue owns retry semantics.

## Trade reconstruction (`src/lib/journal/reconstruct.ts`) — pure, TDD

`reconstructTrades(deals): { trades, cashFlows }`

- Group non-balance deals by `positionId`.
- Entries = `DEAL_ENTRY_IN` (+ the IN leg of `INOUT`); exits = `OUT`, `OUT_BY`,
  `INOUT`. Direction = type of first entry deal.
- `open_price` = volume-weighted avg of entries; `close_price` = VWAP of exits.
- `status = open` while exited volume < entered volume (partial closes stay
  one trade; `profit` reflects realized legs so far).
- `net_profit = profit + commission + swap` summed across all deals of the
  position.
- `DEAL_TYPE_BALANCE` deals → cash flows.
- Deterministic on out-of-order input (sort by time, then deal id).

## API surface (`src/app/api/journal/…`)

All user routes resolve the caller via `getAccess()` and fail closed
(`requireFull()` pattern); cron route uses `CRON_SECRET` bearer + service role.

- `POST /api/journal/accounts` — body `{ login, password, server, label }`.
  Validates, provisions at MetaApi, inserts `journal_accounts`
  (state `connecting`), enqueues initial sync job. Never logs/stores password.
- `DELETE /api/journal/accounts/:id` — undeploy+remove at MetaApi (best-
  effort), set state `disconnected`. Trade data is kept.
- `POST /api/journal/accounts/:id/sync` — manual "Sync now"; rate-limited
  (rejects if a sync ran/queued within 5 min).
- `GET | PUT /api/journal/goals` — read/save goals row.
- `POST /api/journal/cron/sync` — the worker (see pipeline). `maxDuration 300`.
  Enqueue → claim batch (default 25, concurrency 5) → process → self-chain via
  `fetch` to itself while jobs remain (depth-capped). Also refreshes account
  state for `connecting` accounts and balance/equity snapshots.
  Scheduled by **pg_cron + pg_net every 15 min** (same pattern as
  daily-stats; consumes no Vercel Hobby cron slot). Per-account cadence:
  sync if `last_synced_at` older than 4 h.

## UI (Phase 1)

- **`/journal`** — gated page (Full tier). No account → hero + "Connect your
  MT5" CTA. Connected → account card (state, balance/equity, last sync,
  Sync now, Disconnect), headline stats (net P&L, win rate, trades,
  profit factor — from `src/lib/journal/metrics.ts`, pure + tested), and a
  paginated trade table (symbol, direction, volume, open/close, duration,
  net P&L). Open positions listed separately.
- **`/journal/connect`** — two-step wizard: ① MT5 credentials (login,
  investor password with "read-only, never stored" reassurance copy, broker
  server, label) → ② goals (structured fields + focus free-text). Goals are
  skippable, editable later from /journal.
- **AppShell nav**: "Trading Journal" entry.
- States surfaced honestly: `connecting` (MetaApi deploying, poll),
  `failed` (wrong password/server — show MetaApi detail, offer retry),
  `deployed` + `sync_error` (show last error, keep old data).

## Error handling

- Provisioning failure → account row saved as `failed` with detail; user can
  edit + retry (re-provision).
- Sync job failure → retried up to 3× by the queue; then surfaced on the
  account card. Old data always remains readable.
- MetaApi outage → jobs pile up as `queued`, drain when service returns.
  No data loss (cursor only advances after a successful upsert batch).
- Cron route is idempotent and safe to double-fire (SKIP LOCKED claiming).

## Security

- Investor password: pass-through to MetaApi over TLS; never persisted,
  never logged. UI copy states this explicitly.
- RLS on every journal table (`user_id = auth.uid()`); service role only in
  the cron worker (server-only).
- `METAAPI_TOKEN` server-only env; cron guarded by `CRON_SECRET` bearer.
- Investor password grants read-only MT5 access by design (no trading, no
  withdrawals) — worst-case blast radius is trade-history disclosure.

## Testing

- Vitest (existing setup): `reconstruct.test.ts` (positions from deals:
  simple round-trip, partial closes, INOUT reversal, out-of-order deals,
  balance deals → cash flows, open positions), `metrics.test.ts` (P&L, win
  rate, profit factor, empty/edge cases), plus cursor/scheduling pure helpers.
- MetaApi wrapper and routes: thin, reviewed, exercised in dev against a real
  demo MT5 account (manual E2E) — matching how tv/ and sendpulse are treated.

## Operational notes

- New env: `METAAPI_TOKEN`, `METAAPI_REGION` (+ ensure `CRON_SECRET` is set).
- pg_cron schedule applied once in Supabase SQL editor (snippet in migration
  comment, same convention as growth_daily).
- MetaApi billing is per active connected account — the `disconnected` state
  must always undeploy at MetaApi so we stop paying for dead accounts.
- Capacity: 15-min ticks × ~40 jobs/tick ≈ 3,800 account-syncs/day at a 4 h
  cadence ≈ comfortable headroom for ~600 accounts per tick-cycle; raise batch
  size/concurrency or add a second pg_cron tick to scale — no code change.
