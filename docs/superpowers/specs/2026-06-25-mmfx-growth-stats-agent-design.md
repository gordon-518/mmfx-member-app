# MMFX Growth-Stats Daily Agent — Design Spec

**Date:** 2026-06-25
**Author:** Gordon (via brainstorming)
**Brief:** `docs/growth-stats-agent-brief.md`
**Status:** Approved design — ready for implementation plan.

---

## Goal

Give Gordon a daily pulse on business growth without running queries: a
**logged-in admin dashboard** at `/admin/growth` showing headline metrics with
day-over-day / week-over-week deltas and trend charts, backed by a **daily 9am
SGT snapshot**, plus a **morning Telegram DM** with an **AI-written narrative**
summarising the numbers and surfacing action triggers.

All reports are **aggregate counts only** — no member PII leaves the server.

---

## Decisions (locked)

| Decision | Choice |
|---|---|
| Primary surface | Admin-gated dashboard `/admin/growth` |
| Snapshot cadence | Daily at 09:00 SGT = `0 1 * * *` UTC |
| Scheduler | **`pg_cron` + `pg_net`** fires an HTTP POST to a Vercel route (does NOT consume a Hobby cron slot) |
| Morning push | Dashboard **and** Telegram DM |
| Narrative | **AI narrative** (Anthropic API) included |
| Metrics | Full headline set + secondary (TV-engagement %, broker split) |
| Telegram creds | Gordon provides `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` |
| Anthropic | Called via `fetch` (no new dependency); model `claude-haiku-4-5` |

### Why `pg_cron` + `pg_net` and not a 3rd Vercel cron

`vercel.json` already registers two crons (`tv-sync`, `sendpulse-sync`) and the
Vercel Hobby plan caps cron jobs at that limit. We also want the daily job to run
in a Node runtime (it must call the Anthropic API and the Telegram API, which
in-DB SQL cannot do cleanly). Solution: Postgres `pg_cron` schedules the job and
`pg_net` POSTs to a normal `/api/cron/daily-stats` route (authenticated by
`CRON_SECRET`). The route is **not** listed in `vercel.json`, so it consumes no
Hobby cron slot, yet runs in Node with the service role. This preserves the exact
9am-SGT timing with no Pro upgrade and no fragile dependency on the other crons.

---

## Architecture

Four units, each independently testable:

```
pg_cron (01:00 UTC)
   └─ pg_net.http_post  ──►  /api/cron/daily-stats  (Node, CRON_SECRET-gated)
                                  │ 1. service-role read of profiles
                                  │ 2. computeMetrics()  ── src/lib/growth/metrics.ts (pure, unit-tested)
                                  │ 3. upsert growth_daily row (numbers + narrative)
                                  │ 4. buildNarrative()  ── Anthropic API (fetch)
                                  │ 5. sendTelegram()    ── src/lib/telegram.ts
                                  └─ returns { ok, date, metrics summary }

/admin/growth  (admin-gated page)
   ├─ reads growth_daily (history → DoD/WoW deltas + trend charts)
   ├─ live-computes "current" totals (same metrics lib)
   └─ renders cards + inline-SVG charts + latest narrative
```

### Unit 1 — Snapshot table + scheduler (migration)

New migration `supabase/migrations/2026XXXXXXXXXX_growth_daily.sql`:

**Table `public.growth_daily`** — one row per day:

| Column | Type | Notes |
|---|---|---|
| `date` | `date` | PK (the SGT calendar date of the snapshot) |
| `signups_today` | `int` | new signups that day |
| `signups_7d` | `int` | rolling 7-day signups |
| `signups_30d` | `int` | rolling 30-day signups |
| `trials_active` | `int` | `trial_active` + `re_trial_active` (live count at snapshot) |
| `trials_expiring_48h` | `int` | active trial, `trial_ends_at` within 48h |
| `conversions_today` | `int` | `deposit_verified_at` on that day |
| `members_active` | `int` | `member_active` |
| `churn_today` | `int` | `downgraded_at` on that day OR flipped to `member_expired` |
| `tv_engagement_pct` | `numeric` | % of members with `tradingview_username` set |
| `broker_split` | `jsonb` | `{ octa: n, dupoin: n, elev8: n }` among members |
| `narrative` | `text` | the morning's AI read (nullable) |
| `created_at` | `timestamptz` | `now()` |

**RLS:** enable RLS; `SELECT` policy for admins only (reuse `is_admin()`); no
client writes (only the service-role route upserts). Aggregate counts only, so
even if read it exposes no PII.

**Scheduler:** enable `pg_cron` and `pg_net` extensions; schedule a job named
`daily-growth-stats` at `0 1 * * *` that calls
`net.http_post(url := '<APP_URL>/api/cron/daily-stats', headers := jsonb with
Authorization: Bearer <CRON_SECRET>)`. The URL and secret are injected via the
migration using Postgres settings / a one-time `ALTER DATABASE … SET`, OR the
migration documents the exact `cron.schedule(...)` call for Gordon to run with
the live values (secret must not be committed). **The secret is never hard-coded
in a committed migration** — the migration ships a templated `cron.schedule`
snippet and the real values are applied out-of-band.

### Unit 2 — Metrics lib `src/lib/growth/metrics.ts`

Pure functions over an array of minimal profile rows (the route fetches only the
columns needed). Mirrors the testable style of `src/lib/trial/status.ts`.

- `computeMetrics(rows, now)` → the full metric object above.
- Date math uses **SGT (UTC+8)** day boundaries so "today" matches the 9am-SGT
  snapshot. A small helper converts `now` → SGT calendar date.
- Delta helpers: `deltaPct(current, prior)` for DoD/WoW display.

Columns fetched from `profiles`: `signup_at, account_status, trial_ends_at,
deposit_verified_at, downgraded_at, member_status, broker, tradingview_username`.

Unit tests (`metrics.test.ts`, vitest — already in repo): synthetic rows assert
each count, the 48h window edge, SGT day-boundary handling, and broker split.

### Unit 3 — Cron route `src/app/api/cron/daily-stats/route.ts`

Same shape as `tv-sync/route.ts`:
- Reject unless `Authorization: Bearer ${CRON_SECRET}`.
- Service-role client (server-only) reads the profile columns above.
- `computeMetrics()` → upsert `growth_daily` for today's SGT date (`onConflict:
  date`).
- `buildNarrative(metrics, priorDay, priorWeek)` → Anthropic `fetch` call
  (`claude-haiku-4-5`, small max_tokens). Prompt feeds **numbers only** (no PII),
  asks for a 3–5 sentence growth read with explicit callouts (e.g. "conversions
  up 30% WoW", "12 trials expire in 48h — nudge them"). On API failure, narrative
  is `null` and the rest still succeeds (degrade gracefully).
- Persist the narrative onto the row.
- `sendTelegram(text)` with the headline numbers + narrative. On failure, log and
  continue (the snapshot is the source of truth; push is best-effort).
- Return `{ ok: true, date, metrics }`. Accept GET (manual test) and POST
  (pg_net).

Idempotent: re-running the same day upserts the same `date` row.

### Unit 4 — Telegram lib `src/lib/telegram.ts`

- `sendTelegram(text, opts?)` → POST `https://api.telegram.org/bot<token>/sendMessage`
  with `chat_id` and `parse_mode: "HTML"` (or Markdown). Reads
  `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`. Returns ok/err; never throws into the
  caller's critical path.

### Unit 5 — Dashboard `src/app/admin/growth/page.tsx`

- Admin gate identical to `/admin` (`supabase.auth.getUser()` + `is_admin` rpc;
  render "Not authorized." otherwise).
- Reads recent `growth_daily` rows (e.g. last 30) for trends + the latest
  narrative.
- Live-computes "current" totals via the same metrics lib (so the page is never
  stale between snapshots) — labelled "as of now"; snapshot-derived deltas
  labelled by date.
- Renders:
  - **Narrative banner** — today's AI read at the top.
  - **Headline cards** — signups (today/7d/30d), active trials, expiring ≤48h,
    conversions, active members, churn — each with DoD + WoW delta chips.
  - **Secondary** — TV-engagement %, broker split.
  - **Trend charts** — lightweight **inline SVG** sparkline/bars (signups over
    time; trials vs members over time). **No new charting dependency** — matches
    the deliberately-plain admin ethos.
- Reuses the warm-premium tokens/classes already in `/admin` (`bg-paper`,
  `text-ink`, `font-display`, card styling).
- Add a link to `/admin/growth` from the `/admin` header/nav.

---

## Environment variables (new)

Set in `.env.local` and Vercel prod:
- `TELEGRAM_BOT_TOKEN` — Gordon provides.
- `TELEGRAM_CHAT_ID` — Gordon provides.
- `ANTHROPIC_API_KEY` — for the narrative.

Already present and reused: `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`.

For `pg_cron`/`pg_net`, the app's base URL + `CRON_SECRET` are needed inside
Postgres to make the outbound call. These are applied out-of-band (not committed).

---

## Security & constraints

- Service-role key is **server/cron only** — never shipped to the client.
- All `profiles` access is **read-only**; the agent only writes `growth_daily`.
- Reports are **aggregate counts** — no emails/names in the snapshot, the
  narrative prompt, the Telegram message, or the dashboard.
- `growth_daily` RLS: admin-only SELECT; writes only via service role.
- `CRON_SECRET` gates the route exactly like `tv-sync`.
- No secret committed in a migration.

---

## Testing / Definition of done

1. `metrics.test.ts` passes (counts, 48h edge, SGT boundary, broker split).
2. Manual `GET /api/cron/daily-stats` with the bearer secret writes a
   `growth_daily` row whose numbers match the live `/admin` panel
   (baseline sanity: `trials_active ≈ 208`, `members_active ≈ 110`).
3. A Telegram DM arrives with the headline numbers + narrative.
4. `/admin/growth` renders cards, deltas, charts, and the narrative; non-admins
   see "Not authorized."
5. `npm run build` succeeds.
6. `pg_cron` job is scheduled and fires the route at 01:00 UTC (verify next-run
   in `cron.job` / a manual `SELECT cron.schedule(...)` smoke test).

---

## Out of scope (YAGNI for now)

- Email digest (Telegram + dashboard cover the need).
- Per-cohort conversion-rate attribution beyond simple period conversions.
- Threshold/anomaly alerting (only the daily push for now).
- Geo breakdown (broker split is the proxy at launch).
