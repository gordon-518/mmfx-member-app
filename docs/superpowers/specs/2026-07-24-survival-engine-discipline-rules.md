# Survival Engine — Layer 2: Discipline Rules Engine

**Date:** 2026-07-24
**Status:** Approved design — pending plan
**Related:** [[2026-07-24-survival-engine-leak-health]] (Layer 1), journal core.

## Context

Layer 2 of the Survival Engine (retention moat). The trader sets their own
discipline **rules**; the journal checks the verified, tamper-proof trade data for
**breaches** and produces a **process score that is independent of P&L** — you can be
green and undisciplined, or red and disciplined; the score rewards the behaviour that
keeps accounts alive.

Like Layer 1, this is **detect + score after the fact**, not real-time enforcement
(sync runs a few times/day, so we flag "you breached your max daily loss on these 3
days" — the live "step away" nudge is Layer 3).

## Non-goals

- Real-time blocking / live nudges (Layer 3).
- True "risk % per trade" — MetaApi's closed-trade data has lots + realized P&L but
  **no stop-loss distance**, so per-trade risk is expressed as **max lots** (or
  realized loss), not a live 1% check.
- Layer 3 (interventions) and the trackable-over-time score chart (can add later).

## The six rules (all checkable from verified data)

Stored per-rule as `{enabled, value, ...}`; all default **off** — opt-in per rule.

1. **max_daily_loss** `{enabled, value, is_pct}` — a trading day breaches if its net
   P&L < −value ($; or value% of the account's starting balance when `is_pct`).
2. **max_trades_per_day** `{enabled, value}` — a day breaches if its closed-trade
   count > value.
3. **max_consec_losses** `{enabled, value}` — breaches on any day containing a trade
   entered after `value` consecutive losses (the tilt guard). Day-level.
4. **max_lots** `{enabled, value}` — any trade with volume > value breaches
   (per-trade).
5. **instruments_only** `{enabled}` — any trade whose symbol ∉ `goals.instruments`
   breaches (per-trade). Needs goals.instruments set (else the rule is inert +
   nudges them to set instruments).
6. **allowed_sessions** `{enabled, value: string[]}` — any trade whose session
   (London / New York / Asian, from open_time UTC — reuse Layer 1's `sessionOf`) ∉
   value breaches (per-trade).

## Engine — `src/lib/journal/rules.ts` (pure, TDD, mirrors `leaks.ts`)

`evaluateRules(trades, rules, goals, startingBalance) → RulesResult` over the **last
30 days** of closed trades (windowed by the caller, like Layer 1).

```ts
type RuleKey = "max_daily_loss" | "max_trades_per_day" | "max_consec_losses"
             | "max_lots" | "instruments_only" | "allowed_sessions";

interface Breach {
  rule: RuleKey;
  title: string;          // "Max daily loss"
  when: string;           // ISO date (day rules) or trade close_time
  detail: string;         // "Lost $420 vs your $200 limit"
  tradeIds: string[];     // the trades behind it (verifiable)
}
interface RuleAdherence {
  rule: RuleKey;
  title: string;
  unit: "day" | "trade";
  kept: number;           // days/trades that respected it
  total: number;
  breachCount: number;
  enabled: boolean;
  inert?: boolean;        // enabled but not evaluable (e.g. instruments_only w/ no instruments)
}
interface RulesResult {
  score: number | null;   // % of trading days with zero breaches (null if no active rules / no trades)
  cleanDays: number;
  tradingDays: number;
  perRule: RuleAdherence[];
  breaches: Breach[];     // most recent first
}
```

- **Score** = `round(cleanDays / tradingDays × 100)`; a trading day = a UTC day with
  ≥1 closed trade; a **clean day** = no breach of any *active* rule that day. `null`
  when no rules are enabled or there are no trading days.
- **Day-level rules** (1,2,3): adherence in days (kept days / trading days).
- **Trade-level rules** (4,5,6): adherence in trades (kept trades / total trades).
- Every breach carries the trade ids behind it.

## Data — `journal_rules` table

One row per user, jsonb config so new rules need no migration:

| column | notes |
|---|---|
| `user_id` (uuid, PK) | FK to the user (mirror `journal_goals`) |
| `config` (jsonb) | the six-rule object above; missing keys = disabled |
| `updated_at` (timestamptz) | |

Own-row RLS (select/insert/update/delete where `user_id = auth.uid()`), mirroring
`journal_goals`. Applied via a dated migration + the `scripts/apply-*` pattern.

## API — `PUT`/`GET` `/api/journal/rules`

Mirror `/api/journal/goals`: admin-gated (staged rollout), validates the config
(numbers ≥ 0, sessions ⊆ known), upserts the user's row.

## Surface

- **Rules editor** — a "Discipline rules" card on the journal: a row per rule with a
  toggle + threshold input; PUTs to `/api/journal/rules`.
- **Discipline card** — on the dashboard next to the Survival panel: the **score big**,
  **per-rule adherence** (kept X/Y + breach count), and the **breach log** expandable
  to the trades. Shows an empty/CTA state when no rules are set.
- **Coach integration** — add the score + top breaches to `ReportContext` +
  `buildReportPrompt` so the report can say "you broke your max-daily-loss rule 4×."

## Data inputs

`journal_trades` (last 30d closed), `journal_rules.config`, `journal_goals`
(instruments), the account's starting balance (from `analytics.startingBalance`).

## Testing

- `rules.test.ts`: a fixture exercising each of the 6 rules — correct breaches,
  tradeIds, day-vs-trade units, and the clean-day score; disabled rules ignored;
  inert instruments_only (no goals) flagged; empty/no-rule safety (score null).
- Coach prompt includes the discipline lines when present.

## Open items / future

- Layer 3 (real-time nudges/interventions + email).
- Trackable discipline-score-over-time chart.
- Structured session enforcement leans on the same `sessionOf` buckets as Layer 1;
  refine session boundaries with real data.
- Thresholds/among rules are user-set; sensible default suggestions could be added.
