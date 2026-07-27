# Survival Engine — Layer 3: Proactive Interventions

**Date:** 2026-07-27
**Status:** Approved design — pending plan
**Related:** [[2026-07-24-survival-engine-leak-health]] (L1), [[2026-07-24-survival-engine-discipline-rules]] (L2), journal core.

## Context

Layer 3 of the Survival Engine (the retention moat). Layers 1 and 2 surface
leaks, account health, and a discipline score **on the dashboard** — passive,
only seen when the trader opens the journal. Layer 3 is the **reach-out engine**:
it decides the single most important thing for each trader right now and delivers
it **proactively** — an email when it matters, plus a can't-miss in-app banner —
so a lapsing trader gets pulled back and a blow-up spiral gets interrupted even
when they are not looking at the dashboard.

Data syncs a few times a day (broker read-only sync), so this is **detect + reach
out after the fact**, not real-time enforcement. Live "step away" blocking is out
of scope (we have no live feed).

## Scope — three intervention moments (tight, opt-in later)

1. **blowup_alert** — account health is `critical` (near the drawdown limit). The
   one that can save an account. `email + banner`.
2. **weekly_focus** — every Monday, the single biggest thing to work on this week.
   The core retention drip. `email + banner`.
3. **inactivity_nudge** — no new trades in **10 days**. Pulls a lapsing trader
   back (directly tied to IB volume). `email` only (an inactive trader is not
   looking at the banner).

Deferred (not in L3): discipline-slip nudge, win-reinforcement, login-based
inactivity, SMS/Telegram, a discipline-score-over-time chart.

## Non-goals

- Real-time blocking / live cooldowns (no live feed).
- Login/page-view tracking (we key inactivity off synced trade data, no new
  tracking infra).
- Sending to real clients now — **admin-gated** during this build (see Rollout).

## Engine — `src/lib/journal/interventions.ts` (pure, TDD)

`decideInterventions(signals, now) → Intervention[]` returns the interventions
that are **currently true**. It does NOT know about dedup/history — that lives in
the send layer — so it stays pure and deterministic (`now` passed in, no `Date`).

```ts
export type InterventionKind = "blowup_alert" | "weekly_focus" | "inactivity_nudge";

export interface InterventionSignals {
  health: Health;            // L1
  leaks: LeakResult;         // L1
  rules: RulesResult;        // L2
  lastTradeAt: string | null;// most recent closed-trade close_time
  hasClosedTrades: boolean;
}

export interface Intervention {
  kind: InterventionKind;
  severity: "critical" | "info";
  channels: ("email" | "banner")[];
  headline: string;   // email subject / banner title
  body: string;       // 1–3 sentences grounded in real numbers
  action: string;     // the one concrete next step
  episodeKey: string; // dedup identity (see below)
}
```

Decision rules:

- **blowup_alert** — emit when `signals.health.status === "critical"`.
  severity `critical`, channels `email + banner`. body from
  `health.runwaySentence`; action = step down size / stop for the day.
  `episodeKey = "blowup:" + now.slice(0,10)` (calendar day; the send layer adds a
  48h cooldown so a prolonged drawdown reminds at most every 2 days).
- **weekly_focus** — always emit on evaluation (it is the standing weekly drip);
  the send layer restricts email to Mondays / once per ISO week. severity `info`,
  channels `email + banner`. **Focus pick order:** the #1 leak
  (`leaks.leaks[0]`) → else the worst-adhered *enabled* rule with the most breaks
  (`rules.perRule`) → else a generic "set your rules / log your trades" prompt
  when there is no signal yet. `episodeKey = "weekly:" + isoWeek(now)`.
- **inactivity_nudge** — emit when `hasClosedTrades` and days between
  `lastTradeAt` and `now` ≥ `INACTIVE_DAYS` (10). severity `info`, channels
  `email`. `episodeKey = "inactivity:" + lastTradeAt.slice(0,10)` so it fires once
  per dormant spell and re-arms only after a new trade.

`isoWeek(iso)` — pure helper returning `YYYY-Www` (ISO-8601 week).

## Dedup & cadence — send layer, from a log table

`journal_interventions` — append-only log:

| column | notes |
|---|---|
| `id` (uuid, PK, default gen) | |
| `user_id` (uuid) | FK to auth.users, on delete cascade |
| `kind` (text) | InterventionKind |
| `episode_key` (text) | the engine's episodeKey |
| `channel` (text) | `email` \| `banner` |
| `sent_at` (timestamptz, default now()) | |

Index on `(user_id, kind, sent_at desc)`. Own-row RLS (select) mirroring
`journal_goals`; inserts happen via the service-role cron, which bypasses RLS.

Pure helper `filterUnsent(interventions, log, now) → Intervention[]` (email
channel only):
- drop an intervention whose `(kind, episode_key)` already appears in `log`;
- **blowup extra:** also drop if any `blowup_alert` was logged within the last
  **48h** (`BLOWUP_COOLDOWN_H`), regardless of episode_key;
- **weekly extra:** only pass when `now` is a **Monday** (UTC) — the once-per-week
  episode_key handles the rest.

## Delivery — `POST /api/journal/cron/interventions`

- Auth: Bearer `JOURNAL_CRON_SECRET` (same secret + convention as
  `journal-sync`). Scheduled **once daily** (≈13:00 UTC) via Supabase pg_cron +
  pg_net — no Vercel cron slot.
- For each connected journal account's user: load trades (paginate past the
  PostgREST 1000-row cap), reuse the existing analytics/health/leaks/rules
  loaders (as in `loadReportContext`) to build `InterventionSignals`, load that
  user's recent `journal_interventions`, run `decideInterventions` then
  `filterUnsent`, and for each surviving `email` intervention: **skip unless the
  user is admin** (rollout gate) and **skip if opted out**, otherwise
  `sendEmail(...)` and insert a log row.
- Best-effort per user (one failure never blocks the rest); idempotent (the log +
  cooldown make re-runs safe).

## In-app — `InterventionBanner`

A client component at the top of the journal dashboard. Runs
`decideInterventions` on the signals already computed server-side (no new fetch),
takes the highest-severity `banner`-channel intervention (`critical` red >
`info`/weekly orange), and renders headline + action + a link into the relevant
section. Dismissible for the session (local state). Inactivity never shows here.

## Opt-out & email

- `journal_email_prefs(user_id uuid pk → auth.users, opted_out bool default false,
  unsub_token text unique, updated_at timestamptz default now())`. Own-row RLS.
  `unsub_token` is a random opaque token minted on first email (or upfront), used
  by a **public** `GET /api/journal/email/unsubscribe?token=…` that flips
  `opted_out = true` (no auth — must work from an email client; token is the
  capability). Unknown token → generic "already unsubscribed" page (no
  enumeration signal).
- Every email includes the unsubscribe link. Inert while admin-only, compliant
  (CAN-SPAM / PDPA) the day it opens to clients.
- One inline-styled HTML template — pure builder
  `interventionEmailHtml({ headline, body, action, ctaUrl, unsubUrl }) → string` —
  sent via the existing `sendEmail`. From = the MMFX sender the Fundamental Desk
  uses. CTA → the journal URL (`NEXT_PUBLIC_APP_URL` + `/journal`).

## Data inputs

`journal_trades` (paginated), the L1/L2 engines over their existing windows,
`journal_interventions` (dedup), `journal_email_prefs` (opt-out), `profiles`
(`is_admin` gate, email address).

## Testing

- `interventions.test.ts`: each kind fires under the right signals with correct
  severity/channels/episodeKey; weekly-focus pick order (leak → rule → generic);
  inactivity 10-day boundary; nothing when healthy + active + no leaks.
- `filterUnsent` dedup: already-logged episode dropped; blowup 48h cooldown;
  weekly Monday-only gate.
- `isoWeek` boundaries (year-end week rollover).
- Email HTML builder: contains headline/action/CTA/unsubscribe.

## Rollout-phase (remind at go-live)

- Flip the admin-only email gate to all connected users (one condition in the
  cron), keeping the opt-out check.
- Add a journal **email-preferences toggle** in-app (logged-in opt-out) alongside
  the tokenized link.
- Consider the deferred moments (discipline-slip, win-reinforcement) once the
  core loop is proven on real inboxes.
- Tune `INACTIVE_DAYS` / `BLOWUP_COOLDOWN_H` and the weekly send hour with real
  engagement data.

## Open items / future

- Layer 3+ ideas: streak reinforcement, discipline-score trend email, a monthly
  recap. Batching multiple due interventions into one digest email if a single
  user ever qualifies for several at once (rare given the tight scope).
