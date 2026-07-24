# Survival Engine — Layer 1: Leak & Health Engine

**Date:** 2026-07-24
**Status:** Approved design — pending plan
**Related:** [[2026-07-06-ai-trading-journal-design]] (journal core + `analytics.ts`
+ `coach.ts`), [[ai-trading-journal-moat-roadmap]] (Survival Engine = chosen moat).

## Context

The journal's moat is **retention**: a surviving, disciplined trader = years of IB
rebates; a blown account = $0. The Survival Engine turns the verified, tamper-proof
per-trade data into proactive discipline/anti-blowup coaching. It's built in three
layers, each its own spec → plan → build:

- **Layer 1 (this spec):** Leak & Health engine — the analysis foundation.
- Layer 2 (future): user-set discipline rules engine + process score.
- Layer 3 (future): proactive interventions (cooldowns, weekly focus, nudges, email).

Layer 1 extends the existing `analytics.ts` (expectancy, drawdown, streaks,
by-symbol/session) and `coach.ts` (behavioural signals: revenge sizing,
overtrading, risky-emotion rate → AI report). What's new: **dollar-attribution of
leaks** and an **account-health / anti-blowup indicator**.

## Goal

- Detect the specific ways a trader loses money and attach a **verifiable dollar
  figure** to each, surfacing the single biggest leak.
- Give an honest **account-health status + survival runway** ("~N losses from your
  drawdown limit") that makes a trader slow down before blowing up.
- Feed both into the existing AI coach so its report is quantified, not vague.

## Non-goals

- Layers 2 (rules engine) and 3 (interventions/delivery).
- A trackable 0–100 health *number* (deferred; inputs will exist, easy to add).
- Anything needing the **intra-trade path** (no tick data — we have entry/exit only,
  so "you were up then gave it back" is out of scope).
- Real-time firing (sync is a few times/day; Layer 1 is analysis, not live alerts).

## Honesty principle (load-bearing)

Every dollar figure is **verifiable** — each leak links to the exact trades behind
it. Three tiers, never blurred:
- **Actual cost** — real net P&L of the matching trades (no model).
- **Excess vs baseline** — the extra loss beyond the trader's own normal risk (one
  assumption: P&L scales with lot size for the same trade).
- **What-if** — a clearly-labelled projection, never called "this cost you."

A pattern only surfaces as a **leak when it's actually negative**. A profitable
pattern surfaces as a **strength** (or stays quiet). Leaks ranked by $, **#1
highlighted** — fixing one habit beats a wall of ten.

## Window

**Leaks** are computed over the **last 90 days** of closed trades (or all if fewer)
— recent enough to be actionable, not dominated by fixed habits.

**Health drawdown uses FULL available history** (or the account's real
balance/equity), not 90 days — the peak that defines current drawdown could be
older, and windowing it would understate how close they are to blowing up. Only
health's *behavioural* factors (risk escalation, active-leak count) reference recent
trades.

## Engine 1 — `src/lib/journal/leaks.ts` (pure, TDD)

`detectLeaks(trades, goals, analytics) → Leak[]`, sorted by $ ascending (most
negative first), only negatives kept.

```ts
interface Leak {
  type: "revenge_trading" | "revenge_sizing" | "overtrading" | "off_plan"
      | "worst_slot" | "skewed_rr" | "blowup_losses";
  title: string;            // "Trading after losses"
  dollarImpact: number;     // negative = cost; the headline figure
  tier: "actual" | "excess" | "what_if";
  tradeCount: number;
  tradeIds: string[];       // the exact trades behind it (verifiable)
  detail: string;           // one plain-English line with the specifics
}
```

Detectors (each pure; thresholds are defaults, tunable):

1. **revenge_trading** — trades entered after **2+ consecutive losing trades**
   (ordered by close_time). `dollarImpact` = Σ net_profit of those trades (actual).
   detail: count + their win rate.
2. **revenge_sizing** — among after-loss trades, those with `volume >
   baselineVolume × 1.2` (baseline = median volume of all trades). For each such
   *losing* trade, excess = `net_profit × (volume − baseline) / volume`.
   `dollarImpact` = Σ excess (excess tier). detail: avg size after loss vs baseline.
3. **overtrading** — group by UTC day; days with `count > 5` (matches coach's
   `OVERTRADING_THRESHOLD`). `dollarImpact` = Σ net_profit of trades on those days
   (actual). detail: N overtrading days, their combined P&L.
4. **off_plan** — if `goals.instruments` set, trades whose symbol ∉ instruments.
   `dollarImpact` = Σ net_profit of off-instrument trades (actual). detail: which
   symbols. *(Off-session deferred — goals have no structured session field yet.)*
5. **worst_slot** — bucket trades by **session** (Asian/London/NY via open_time UTC
   hour) and by **day-of-week**; pick the single worst bucket by net P&L.
   `dollarImpact` = that bucket's net (actual). detail: which slot + its record.
6. **skewed_rr** — from analytics `avgWin`/`avgLoss`. If `|avgLoss| > avgWin × 1.5`,
   project net if wins matched losses (1:1): `projected = |avgLoss| × (wins − losses)`.
   `dollarImpact` = `actualNet − projected` (what_if; only if it improves). detail:
   the ratio + the projected figure, labelled a what-if.
7. **blowup_losses** — losses only; `typical = median(|loss|)`; outliers where
   `|loss| > typical × 2.5`. excess = Σ(|loss| − typical) over outliers.
   `dollarImpact` = −excess (excess tier). detail: N oversized losses, how much
   bigger than typical.

Also return **strengths** (same shape, positive `dollarImpact`) for patterns that
are net-positive, so the panel can show "what's working."

## Engine 2 — `src/lib/journal/health.ts` (pure, TDD)

`accountHealth(trades, cashFlows, goals, analytics) → Health`.

```ts
interface Health {
  status: "healthy" | "at_risk" | "critical";
  currentDrawdownPct: number;   // peak-to-current on the reconstructed equity curve
  maxDrawdownTolerancePct: number; // goals.max_drawdown_pct ?? 15 (default)
  runwayTrades: number | null;  // remaining DD room ÷ avg losing trade
  runwaySentence: string;       // "~5 losses from your 10% drawdown limit"
  factors: string[];            // "drawdown 8% of 10%", "risk escalating", "2 leaks active"
  usedDefaultTolerance: boolean; // true → nudge them to set a max-DD goal
}
```

- **currentDrawdownPct**: build a running equity series over **full history**
  (starting balance + cumulative net_profit + cash flows, ordered by time);
  `(peak − current) / peak`. (Not windowed — see Window section.)
- **proximity** = currentDrawdownPct / maxDrawdownTolerancePct. **status**: `healthy`
  < 0.5, `at_risk` 0.5–0.85, `critical` > 0.85.
- **runway**: remainingRoom$ = `tolerance% × peakEquity − currentDrawdown$`;
  `runwayTrades = floor(remainingRoom / |avgLoss|)` (null if avgLoss ≈ 0).
- **factors**: current DD vs tolerance; whether recent risk/size is escalating
  (avg volume of last 10 trades > earlier baseline); count of active leaks.

## Surface

**`SurvivalPanel`** — server-rendered on the journal dashboard
(`JournalDashboard.tsx`), above/near the existing coach card:
- Top: **health status + survival runway sentence** + factors.
- Then the **#1 leak, large and quantified** ($ + one-line detail), with an
  expand-to-trades control (lists the `tradeIds` with their P&L).
- Then the ranked remaining leaks (compact), and a small "what's working"
  (strengths) row.

**Coach integration:** pass the top 1–2 leaks + health status/runway into
`buildReportPrompt` (coach.ts) so the AI daily report references the quantified
leak and the health state instead of generic habits.

## Data inputs (all already loaded for the dashboard/coach)

`journal_trades` (last 90d closed), `journal_cash_flows`, `journal_goals`, and the
computed `JournalAnalytics`. No schema changes, no new tables.

## Testing

- `leaks.test.ts`: a fixture trade set exercising each of the 7 detectors — correct
  `dollarImpact`, tier, tradeIds; negatives-only surfacing; strengths for positives;
  90-day windowing; empty/low-data safety.
- `health.test.ts`: drawdown/proximity → status thresholds; runway math; default
  tolerance + nudge flag; escalation factor; avg-loss ≈ 0 edge (null runway).
- Coach prompt: includes the leak/health lines when present (extend coach.test.ts).

## Open items / future

- Layer 2 (discipline rules engine + process score), Layer 3 (interventions + email).
- Trackable numeric health score (deferred; inputs exist).
- Structured **session** goal field to enable off-session leak detection (today
  off-plan = off-instrument only).
- Detector thresholds (consecutive-loss count, oversize margin, overtrading count,
  outlier multiple, RR ratio, status cutoffs) start as constants — tune with real data.
