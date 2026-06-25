# MMFX Growth-Stats Daily Agent — Build Brief

> **Purpose of this doc:** hand a fresh chat everything it needs to build Gordon a
> daily business-growth report (new signups, trials, active members, conversions,
> churn, etc.). This is a *brief*, not a spec — the design is deliberately open.

---

## ⚠️ READ THIS FIRST — do NOT start coding

**Before building anything, brainstorm with Gordon and ask clarifying questions.**
Invoke the **`brainstorming`** skill and work through the open questions in the
"Brainstorm with Gordon first" section below. Confirm the metrics he actually
cares about, the delivery channel, the cadence, and the architecture *before*
writing code. Gordon explicitly asked for this — present options and trade-offs,
don't jump to an implementation.

---

## What Gordon wants

A **daily update on the growth of his business** — pushed to him automatically,
so he doesn't have to open the admin panel or run queries. Core stats he named:
**new signups, new trials, active members** — "generally the stats I need to know
regarding the growth of the business."

He called it an **"agent."** That can mean a scheduled job that sends a plain
metrics digest, or a genuine AI agent that queries the data and writes a short
natural-language growth narrative (with callouts like "conversions up 30% WoW",
"12 trials expiring tomorrow — nudge them"). Clarify which he wants.

## Why it helps (the value to frame the build around)

- **Daily pulse without effort** — growth visible at a glance every morning.
- **Leading indicators** — trials expiring soon, trial→member conversion rate,
  signup velocity → know where the funnel is leaking before it shows in revenue.
- **Action triggers** — e.g. "8 trials expire in 24h" → a reason to follow up.
- **Trend over time** — deltas vs yesterday / last week / last 30 days, not just
  static totals.

---

## Decided so far (2026-06-25 — Gordon)

- **Primary surface = a logged-in DASHBOARD**, not a daily chat/push. Gordon wants
  to **log in and view the stats directly** any time, instead of going to a chat
  each day. Build an admin-gated growth dashboard page in the member app (he's
  `is_admin`) — e.g. `/admin/growth` or a tab on `/admin`.
- **Refresh cadence: daily at 9:00 AM Singapore time (UTC+8) = `00 1 * * *` UTC.**
  A cron computes the day's metrics at 9am SGT and writes a **daily snapshot**;
  the dashboard reads snapshots so it can show day-over-day / week-over-week
  trends (you can't compute "vs yesterday" without stored history).
- A push digest (email/Telegram) is now **optional/secondary** — confirm if he
  still wants a morning push *in addition* to the dashboard, or dashboard-only.

**Implication:** you need a small **snapshot table** (e.g. `growth_daily`: date +
each metric) that the 9am cron appends to, plus the dashboard page that charts it.
Live-computed "current" numbers can sit alongside the historical snapshots.

## Brainstorm with Gordon first (open questions)

1. **Which metrics matter most?** (See the candidate list below — have him prioritise.)
2. **Delivery — DECIDED: logged-in dashboard.** Remaining: does he *also* want a
   morning push (email/Telegram) on top of the dashboard, or dashboard-only?
3. **Cadence — DECIDED: daily snapshot at 9am SGT (UTC+8).** Remaining: also a
   weekly deeper summary? Should the dashboard's "current" numbers be live on
   every load, or only as-of the 9am snapshot?
4. **Plain digest vs AI narrative:** numbers-only, or a short written read with
   trends + recommended actions?
5. **Granularity:** aggregate counts only, or also names/emails for "new signups
   today" (PII — keep minimal; he may want just counts)?
6. **Breakdowns:** by broker? by geo/country? by trial vs re-trial?
7. **Alerts/thresholds:** only-on-change alerts (e.g. "conversion dropped") in
   addition to the daily digest?

---

## The data model (verified 2026-06-25)

Everything lives in **Supabase** (project ref `dldrcitoeoxzfctsqlmo`), table
**`public.profiles`** (one row per member, created by the `handle_new_user`
trigger on signup). Confirm against **`docs/SCHEMA.md`** and the SQL migrations.

**`profiles` columns:**
`id, email, full_name, signup_at, trial_ends_at, trial_count, account_status,
member_status, last_known_trading_activity, broker, deposit_amount,
deposit_verified_at, deposit_verified_by, ib_link_confirmed, last_activity_at,
downgraded_at, created_at, updated_at, is_admin, tradingview_username`

**`account_status` state machine** (the spine of every metric):
`trial_active → trial_expired`, one `re_trial_active → re_trial_expired`,
`member_active` (on a verified $500 partnered-broker deposit), `member_expired`
(removed/lapsed member). Labels live in `src/lib/trial/status.ts`.

**Key columns per metric:**
- New signups → `signup_at` (or `created_at`) by date
- Active trials → `account_status in (trial_active, re_trial_active)`
- Trials expiring soon → `trial_ends_at` within N days, status active
- Expired trials → `trial_expired, re_trial_expired`
- Active members → `member_active`
- Conversions (trial→member) → `deposit_verified_at` in the period (+ `deposit_amount`)
- Churn → `downgraded_at` in the period / `member_expired`
- Engagement → `last_activity_at`, `last_known_trading_activity`, `tradingview_username` set
- Broker mix → `broker`

**Current baseline (2026-06-25):** `trial_active` ≈ 208, `member_active` ≈ 110
(includes the 108 migrated Softr members). Useful as a sanity check.

## Candidate metrics (have Gordon prioritise)

| Metric | Definition |
|---|---|
| New signups | count by `signup_at` — today, 7d, 30d (+ Δ vs prior period) |
| Active trials | `trial_active` + `re_trial_active` |
| Trials expiring ≤48h | active trial, `trial_ends_at` within 48h |
| Trial→member conversions | `deposit_verified_at` in period |
| Conversion rate | conversions ÷ trials started in a cohort |
| Active members | `member_active` |
| Churn | `downgraded_at` / `member_expired` in period |
| TV engagement | % of members with `tradingview_username` set |
| Broker split | members grouped by `broker` |
| Totals + WoW/DoD deltas | every headline number vs yesterday & last week |

---

## Architecture (shaped by the decisions above)

Two parts: a **daily snapshot cron** + an **admin dashboard page**.

**1. Snapshot cron — runs 9am SGT (`00 1 * * *` UTC).** Computes the day's metrics
and appends a row to a `growth_daily` snapshot table. Mechanism options:
- **A. Vercel cron route** `/api/cron/daily-stats` in `vercel.json` (same pattern
  as `/api/cron/tv-sync`, auth via `CRON_SECRET`). Simplest; reuses existing setup.
- **B. Supabase `pg_cron` + a SQL function** that writes the snapshot in-DB. Keeps
  it off Vercel; pairs with `pg_net` if it also needs to push.
- (Vercel Hobby cron granularity is fine for a once-daily job.)

**2. Dashboard page — admin-gated, in the member app.** A new route (e.g.
`/admin/growth`) that reads `growth_daily` (for trends/deltas) and optionally
live-computes "current" totals. Render headline cards (signups, trials, members,
conversions, churn) with DoD/WoW deltas + simple trend charts. Gate with the
existing admin check (`is_admin` / `requireAdmin`).

**Snapshot table (sketch):** `growth_daily(date PK, signups_today, trials_active,
trials_expiring_48h, conversions_today, members_active, churn_today, …)` — one row
per day, appended by the cron. This history is what makes "vs yesterday / last
week" possible.

**Optional LLM narrative:** a step (cron or on-page) that turns the numbers into a
short written read with callouts. Only if Gordon wants it (has LLM cost).

## Delivery

- **Primary: the dashboard** (above) — Gordon logs in and views any time.
- **Optional secondary push** (only if he confirms he wants a morning nudge too):
  - **Email** — SendPulse SMTP already configured (`smtp-pulse.com:2525`, sender
    `hello@marketmakersfx.net`), or the SendPulse API (creds in `.env.local`).
  - **Telegram** — he lives in Telegram; a bot DM is low-friction (needs bot token
    + his chat id).

---

## Reuse these existing patterns (member-app repo)

- **Cron pattern:** `src/app/api/cron/tv-sync/route.ts` + `vercel.json` crons,
  auth via `Authorization: Bearer CRON_SECRET`.
- **Read-only service-role access (server only):** the tv-sync cron reads all
  profiles with the service role. **Rule: service_role key NEVER ships to the
  client — server/cron context only.** Reports must be **aggregate counts**, no
  member PII beyond what Gordon explicitly asks for.
- **Pooler DB access for scripts:** `aws-1-ap-southeast-2.pooler.supabase.com:5432`,
  user `postgres.dldrcitoeoxzfctsqlmo` (direct host is IPv6-only). See the
  DB/testing notes.
- **SendPulse API:** `src/app/api/sendpulse/route.ts` (OAuth client_credentials
  → API calls); creds `SENDPULSE_API_ID/SECRET` in `.env.local` + Vercel.
- **Admin metrics precedent:** `/admin` already lists/filters members by status —
  reuse the query shapes.

## Access / env / security

- Supabase URL: `https://dldrcitoeoxzfctsqlmo.supabase.co`; service-role key in
  `.env.local` (and Vercel prod) as `SUPABASE_SERVICE_ROLE_KEY`.
- All queries **read-only**. No writes from the stats agent.
- Don't commit any member PII (emails/names) — keep reports aggregate.
- Deploy: member app deploys via **git push to `main`** (SSH remote
  `git@github.com:gordon-518/mmfx-member-app.git`, author must be
  `gordon@marketmakersfx.net` or Vercel rejects the build). Vercel team
  `market-makers` (Hobby).

---

## Definition of done (suggested — confirm with Gordon)

A daily cron at **9am SGT** writes a `growth_daily` snapshot, and an **admin-gated
dashboard page** lets Gordon log in and view the prioritised metrics with
day-over-day / week-over-week deltas and trend charts — no chat needed. Optional:
a morning push and/or an LLM narrative if he confirms he wants them. Verified
against the live numbers and the `/admin` panel.
