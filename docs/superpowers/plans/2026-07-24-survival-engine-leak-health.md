# Survival Engine — Layer 1 (Leak & Health Engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn verified trade data into a ranked list of dollar-quantified leaks and an account-health/survival-runway indicator, surfaced on the journal dashboard and fed into the AI coach.

**Architecture:** Two pure, TDD'd modules — `leaks.ts` (7 detectors, $-ranked, verifiable) and `health.ts` (drawdown-proximity status + survival runway) — mirroring `analytics.ts`/`coach.ts`. The journal page computes them (leaks over 90 days, health over full history) and passes them to a `SurvivalPanel` on the dashboard; the top leak + health also feed `buildReportPrompt` so the coach report is quantified. No schema changes.

**Tech Stack:** TypeScript, Next.js server components, Vitest. Reuses `computeAnalytics`, `JournalTradeRow`, `JournalGoalsRow`, `JournalAnalytics` (`Breakdown`, `CurvePoint`).

**Spec:** `docs/superpowers/specs/2026-07-24-survival-engine-leak-health.md`

**Admin-only:** the journal is already admin-gated; this rides on it.

---

## File Structure

**Create:**
- `src/lib/journal/leaks.ts` — pure leak detectors + orchestrator.
- `src/lib/journal/leaks.test.ts`
- `src/lib/journal/health.ts` — pure account-health.
- `src/lib/journal/health.test.ts`
- `src/app/journal/SurvivalPanel.tsx` — dashboard panel (client, presentational).

**Modify:**
- `src/app/journal/page.tsx` — compute leaks/health, pass to dashboard.
- `src/app/journal/JournalDashboard.tsx` — accept + render `SurvivalPanel`.
- `src/lib/journal/coach.ts` — `ReportContext` + `buildReportPrompt` include leaks/health; `loadReportContext` computes them.

---

## Task 1: Leak engine (`leaks.ts`)

**Files:** Create `src/lib/journal/leaks.ts`, `src/lib/journal/leaks.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { detectLeaks } from "./leaks";
import type { JournalTradeRow } from "./types";
import type { JournalAnalytics } from "./analytics";

// Minimal trade factory (closed, with the fields the detectors read).
let seq = 0;
function t(over: Partial<JournalTradeRow>): JournalTradeRow {
  seq += 1;
  return {
    id: `t${seq}`,
    account_id: "a",
    position_id: `p${seq}`,
    symbol: "XAUUSD",
    direction: "buy",
    status: "closed",
    volume: 0.4,
    open_price: 1,
    close_price: 1,
    open_time: `2026-07-0${((seq - 1) % 9) + 1}T10:00:00.000Z`,
    close_time: `2026-07-0${((seq - 1) % 9) + 1}T12:00:00.000Z`,
    profit: 0,
    commission: 0,
    swap: 0,
    net_profit: 0,
    duration_sec: 7200,
    note: null,
    tags: null,
    emotion: null,
  };
}
// analytics stub with only the fields leaks reads.
function analytics(over: Partial<JournalAnalytics>): JournalAnalytics {
  return {
    avgWin: 100,
    avgLoss: -100,
    netProfit: 0,
    bySession: [],
    byWeekday: [],
    ...(over as JournalAnalytics),
  } as JournalAnalytics;
}

describe("detectLeaks", () => {
  it("revenge_trading: sums net of trades after 2+ consecutive losses (actual)", () => {
    // L, L, then two trades taken while on a 2-loss run.
    const trades = [
      t({ id: "L1", net_profit: -50 }),
      t({ id: "L2", net_profit: -50 }),
      t({ id: "R1", net_profit: -80 }),
      t({ id: "R2", net_profit: 30 }),
    ];
    const { leaks } = detectLeaks(trades, null, analytics({}));
    const rt = leaks.find((l) => l.type === "revenge_trading");
    expect(rt).toBeTruthy();
    expect(rt!.dollarImpact).toBe(-50); // -80 + 30
    expect(rt!.tier).toBe("actual");
    expect(rt!.tradeIds).toEqual(["R1", "R2"]);
  });

  it("overtrading: nets trades on days above the threshold (actual)", () => {
    const day = (d: string, net: number, id: string) =>
      t({ id, net_profit: net, close_time: `${d}T12:00:00.000Z` });
    // 6 trades on 2026-07-01 (> 5), all losers.
    const trades = Array.from({ length: 6 }, (_, i) =>
      day("2026-07-01", -10, `o${i}`)
    );
    const { leaks } = detectLeaks(trades, null, analytics({}));
    const ot = leaks.find((l) => l.type === "overtrading");
    expect(ot!.dollarImpact).toBe(-60);
    expect(ot!.tradeCount).toBe(6);
  });

  it("off_plan: nets trades on instruments outside goals (actual)", () => {
    const trades = [
      t({ id: "in", symbol: "XAUUSD", net_profit: 20 }),
      t({ id: "off", symbol: "EURUSD", net_profit: -40 }),
    ];
    const { leaks } = detectLeaks(
      trades,
      { instruments: ["XAUUSD"] } as never,
      analytics({})
    );
    const op = leaks.find((l) => l.type === "off_plan");
    expect(op!.dollarImpact).toBe(-40);
    expect(op!.tradeIds).toEqual(["off"]);
  });

  it("blowup_losses: excess of outlier losses beyond typical (excess)", () => {
    // typical loss magnitude 20; one 200 outlier (> 2.5x).
    const trades = [
      t({ id: "l1", net_profit: -20 }),
      t({ id: "l2", net_profit: -20 }),
      t({ id: "l3", net_profit: -20 }),
      t({ id: "big", net_profit: -200 }),
    ];
    const { leaks } = detectLeaks(trades, null, analytics({}));
    const bl = leaks.find((l) => l.type === "blowup_losses");
    expect(bl!.tier).toBe("excess");
    expect(bl!.dollarImpact).toBe(-180); // -(200 - 20)
    expect(bl!.tradeIds).toEqual(["big"]);
  });

  it("skewed_rr: labelled what_if only when it would improve", () => {
    // avgLoss 300 magnitude vs avgWin 100 → skewed; 1 win, 1 loss.
    const trades = [t({ id: "w", net_profit: 100 }), t({ id: "l", net_profit: -300 })];
    const { leaks } = detectLeaks(
      trades,
      null,
      analytics({ avgWin: 100, avgLoss: -300, netProfit: -200 })
    );
    const rr = leaks.find((l) => l.type === "skewed_rr");
    expect(rr!.tier).toBe("what_if");
    // projected = |−300| * (1 win − 1 loss) = 0; impact = actual(−200) − 0 = −200
    expect(rr!.dollarImpact).toBe(-200);
  });

  it("classifies a profitable pattern as a strength, not a leak", () => {
    const trades = [
      t({ id: "L1", net_profit: -50 }),
      t({ id: "L2", net_profit: -50 }),
      t({ id: "R1", net_profit: 200 }), // great after losses
    ];
    const { leaks, strengths } = detectLeaks(trades, null, analytics({}));
    expect(leaks.find((l) => l.type === "revenge_trading")).toBeFalsy();
    expect(strengths.find((s) => s.type === "revenge_trading")?.dollarImpact).toBe(200);
  });

  it("ranks leaks by dollar impact, most negative first", () => {
    const trades = [
      t({ id: "L1", net_profit: -50 }),
      t({ id: "L2", net_profit: -50 }),
      t({ id: "R1", net_profit: -500 }), // revenge, big
      t({ id: "off", symbol: "EURUSD", net_profit: -40 }),
    ];
    const { leaks } = detectLeaks(
      trades,
      { instruments: ["XAUUSD"] } as never,
      analytics({})
    );
    expect(leaks[0].dollarImpact).toBeLessThanOrEqual(leaks[1].dollarImpact);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/journal/leaks.test.ts`
Expected: FAIL — cannot find module `./leaks`.

- [ ] **Step 3: Write the implementation**

```ts
import type { JournalTradeRow, JournalGoalsRow } from "./types";
import type { JournalAnalytics } from "./analytics";

// Pure leak detection. Trades passed in are already windowed (last 90d) by the
// caller so this stays deterministic (no Date). Every leak links to the exact
// trades behind it; only patterns that COST money are leaks — profitable ones
// come back as strengths.

export type LeakType =
  | "revenge_trading"
  | "revenge_sizing"
  | "overtrading"
  | "off_plan"
  | "worst_slot"
  | "skewed_rr"
  | "blowup_losses";

export interface Leak {
  type: LeakType;
  title: string;
  dollarImpact: number; // negative = cost (leak); positive = strength
  tier: "actual" | "excess" | "what_if";
  tradeCount: number;
  tradeIds: string[];
  detail: string;
}

export interface LeakResult {
  leaks: Leak[]; // dollarImpact < 0, most negative first
  strengths: Leak[]; // dollarImpact > 0, most positive first
}

const CONSEC_LOSSES = 2;
const OVERSIZE_MARGIN = 1.2;
const OVERTRADING_THRESHOLD = 5;
const OUTLIER_MULT = 2.5;
const RR_SKEW = 1.5;

const r2 = (n: number) => Math.round(n * 100) / 100;

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function sessionOf(iso: string | null): string {
  if (!iso) return "Unknown";
  const h = new Date(iso).getUTCHours();
  if (h >= 7 && h < 13) return "London";
  if (h >= 13 && h < 22) return "New York";
  return "Asian";
}
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function detectLeaks(
  trades: JournalTradeRow[],
  goals: JournalGoalsRow | null,
  analytics: JournalAnalytics
): LeakResult {
  const closed = trades
    .filter((t) => t.status === "closed" && t.close_time)
    .sort((a, b) => (a.close_time as string).localeCompare(b.close_time as string));

  const candidates: Leak[] = [];

  // 1. revenge_trading — trades taken after 2+ consecutive losses.
  {
    const ids: string[] = [];
    let sum = 0;
    let lossRun = 0;
    for (const tr of closed) {
      if (lossRun >= CONSEC_LOSSES) {
        ids.push(tr.id);
        sum += tr.net_profit;
      }
      lossRun = tr.net_profit < 0 ? lossRun + 1 : 0;
    }
    if (ids.length)
      candidates.push({
        type: "revenge_trading",
        title: "Trading after losses",
        dollarImpact: r2(sum),
        tier: "actual",
        tradeCount: ids.length,
        tradeIds: ids,
        detail: `${ids.length} trades taken after ${CONSEC_LOSSES}+ losses in a row.`,
      });
  }

  // 2. revenge_sizing — oversized losing trades taken right after a loss.
  {
    const baseline = median(closed.map((t) => t.volume));
    const ids: string[] = [];
    let excess = 0;
    for (let i = 1; i < closed.length; i++) {
      const prev = closed[i - 1];
      const cur = closed[i];
      if (
        prev.net_profit < 0 &&
        cur.net_profit < 0 &&
        cur.volume > baseline * OVERSIZE_MARGIN
      ) {
        ids.push(cur.id);
        excess += cur.net_profit * ((cur.volume - baseline) / cur.volume);
      }
    }
    if (ids.length)
      candidates.push({
        type: "revenge_sizing",
        title: "Sizing up after losses",
        dollarImpact: r2(excess),
        tier: "excess",
        tradeCount: ids.length,
        tradeIds: ids,
        detail: `Extra loss from trading bigger than your ${baseline}-lot baseline after a loss.`,
      });
  }

  // 3. overtrading — days above the trade-count threshold.
  {
    const byDay = new Map<string, JournalTradeRow[]>();
    for (const tr of closed) {
      const d = (tr.close_time as string).slice(0, 10);
      const arr = byDay.get(d) ?? [];
      arr.push(tr);
      byDay.set(d, arr);
    }
    const ids: string[] = [];
    let sum = 0;
    let days = 0;
    for (const arr of byDay.values()) {
      if (arr.length > OVERTRADING_THRESHOLD) {
        days += 1;
        for (const tr of arr) {
          ids.push(tr.id);
          sum += tr.net_profit;
        }
      }
    }
    if (ids.length)
      candidates.push({
        type: "overtrading",
        title: "Overtrading",
        dollarImpact: r2(sum),
        tier: "actual",
        tradeCount: ids.length,
        tradeIds: ids,
        detail: `${days} day(s) with more than ${OVERTRADING_THRESHOLD} trades.`,
      });
  }

  // 4. off_plan — instruments outside stated goals.
  {
    const instr = (goals?.instruments ?? []).map((s) => s.toUpperCase());
    if (instr.length) {
      const ids: string[] = [];
      let sum = 0;
      const syms = new Set<string>();
      for (const tr of closed) {
        if (!instr.includes(tr.symbol.toUpperCase())) {
          ids.push(tr.id);
          sum += tr.net_profit;
          syms.add(tr.symbol);
        }
      }
      if (ids.length)
        candidates.push({
          type: "off_plan",
          title: "Trading off your plan",
          dollarImpact: r2(sum),
          tier: "actual",
          tradeCount: ids.length,
          tradeIds: ids,
          detail: `Trades outside your instruments: ${[...syms].join(", ")}.`,
        });
    }
  }

  // 5. worst_slot — worst session or weekday bucket (only if it loses money).
  {
    const buckets = new Map<string, { ids: string[]; net: number }>();
    const add = (key: string, tr: JournalTradeRow) => {
      const b = buckets.get(key) ?? { ids: [], net: 0 };
      b.ids.push(tr.id);
      b.net += tr.net_profit;
      buckets.set(key, b);
    };
    for (const tr of closed) {
      add(`session:${sessionOf(tr.open_time)}`, tr);
      add(`day:${WEEKDAYS[new Date(tr.close_time as string).getUTCDay()]}`, tr);
    }
    let worstKey: string | null = null;
    let worst: { ids: string[]; net: number } | null = null;
    for (const [key, b] of buckets) {
      if (!worst || b.net < worst.net) {
        worst = b;
        worstKey = key;
      }
    }
    if (worst && worst.net < 0 && worstKey)
      candidates.push({
        type: "worst_slot",
        title: `Your worst time slot (${worstKey.split(":")[1]})`,
        dollarImpact: r2(worst.net),
        tier: "actual",
        tradeCount: worst.ids.length,
        tradeIds: worst.ids,
        detail: `${worstKey.split(":")[1]} trades are your biggest bleed.`,
      });
  }

  // 6. skewed_rr — what-if: winners much smaller than losers.
  {
    const aw = analytics.avgWin;
    const al = analytics.avgLoss;
    if (aw != null && al != null && aw > 0 && Math.abs(al) > aw * RR_SKEW) {
      const winIds = closed.filter((t) => t.net_profit > 0).map((t) => t.id);
      const wins = winIds.length;
      const losses = closed.filter((t) => t.net_profit < 0).length;
      const projected = Math.abs(al) * (wins - losses);
      const impact = analytics.netProfit - projected;
      if (impact < 0)
        candidates.push({
          type: "skewed_rr",
          title: "Cutting winners short",
          dollarImpact: r2(impact),
          tier: "what_if",
          tradeCount: winIds.length,
          tradeIds: winIds,
          detail: `Avg loss is ${r2(Math.abs(al) / aw)}× your avg win. Matching them → ${r2(
            projected
          )} vs your actual ${r2(analytics.netProfit)} (what-if).`,
        });
    }
  }

  // 7. blowup_losses — outlier losses beyond typical.
  {
    const losses = closed.filter((t) => t.net_profit < 0);
    const typical = median(losses.map((t) => Math.abs(t.net_profit)));
    const ids: string[] = [];
    let excess = 0;
    if (typical > 0) {
      for (const tr of losses) {
        const m = Math.abs(tr.net_profit);
        if (m > typical * OUTLIER_MULT) {
          ids.push(tr.id);
          excess += m - typical;
        }
      }
    }
    if (ids.length)
      candidates.push({
        type: "blowup_losses",
        title: "Oversized losses",
        dollarImpact: r2(-excess),
        tier: "excess",
        tradeCount: ids.length,
        tradeIds: ids,
        detail: `${ids.length} loss(es) more than ${OUTLIER_MULT}× your typical ${r2(
          typical
        )}.`,
      });
  }

  const leaks = candidates
    .filter((c) => c.dollarImpact < 0)
    .sort((a, b) => a.dollarImpact - b.dollarImpact);
  const strengths = candidates
    .filter((c) => c.dollarImpact > 0)
    .sort((a, b) => b.dollarImpact - a.dollarImpact);
  return { leaks, strengths };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/journal/leaks.test.ts`
Expected: PASS (all 7).

- [ ] **Step 5: Commit**

```bash
git add src/lib/journal/leaks.ts src/lib/journal/leaks.test.ts
git commit -m "feat(journal): leak engine — 7 dollar-quantified detectors + strengths"
```

---

## Task 2: Health engine (`health.ts`)

**Files:** Create `src/lib/journal/health.ts`, `src/lib/journal/health.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { accountHealth } from "./health";
import type { JournalAnalytics } from "./analytics";

function analytics(over: Partial<JournalAnalytics>): JournalAnalytics {
  return {
    startingBalance: 1000,
    avgLoss: -50,
    equityCurve: [],
    ...(over as JournalAnalytics),
  } as JournalAnalytics;
}

describe("accountHealth", () => {
  it("computes current drawdown from peak equity and sets status", () => {
    // start 1000; equity climbs to 1200 (peak) then drops to 1080 → DD 10%.
    const a = analytics({
      startingBalance: 1000,
      equityCurve: [
        { time: "t1", value: 200 }, // eq 1200 peak
        { time: "t2", value: 80 }, // eq 1080
      ],
      avgLoss: -60,
    });
    const h = accountHealth([], a, { max_drawdown_pct: 10 } as never, 0);
    expect(h.currentDrawdownPct).toBe(10);
    expect(h.maxDrawdownTolerancePct).toBe(10);
    // proximity = 10/10 = 1 → critical
    expect(h.status).toBe("critical");
  });

  it("survival runway = remaining room / avg loss", () => {
    // peak 1200, current 1140 → DD 5% ($60); tolerance 10% of peak = $120;
    // remaining room = 120 - 60 = 60; avgLoss 60 → runway 1.
    const a = analytics({
      startingBalance: 1000,
      equityCurve: [
        { time: "t1", value: 200 },
        { time: "t2", value: 140 },
      ],
      avgLoss: -60,
    });
    const h = accountHealth([], a, { max_drawdown_pct: 10 } as never, 0);
    expect(h.runwayTrades).toBe(1);
    expect(h.status).toBe("at_risk"); // proximity 0.5
  });

  it("falls back to a default tolerance and flags it", () => {
    const a = analytics({
      startingBalance: 1000,
      equityCurve: [{ time: "t1", value: 0 }],
    });
    const h = accountHealth([], a, null, 0);
    expect(h.maxDrawdownTolerancePct).toBe(15);
    expect(h.usedDefaultTolerance).toBe(true);
    expect(h.status).toBe("healthy"); // no drawdown
  });

  it("null runway when there is no average loss", () => {
    const a = analytics({ startingBalance: 1000, equityCurve: [], avgLoss: null });
    const h = accountHealth([], a, { max_drawdown_pct: 10 } as never, 0);
    expect(h.runwayTrades).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/journal/health.test.ts`
Expected: FAIL — cannot find module `./health`.

- [ ] **Step 3: Write the implementation**

```ts
import type { JournalTradeRow, JournalGoalsRow } from "./types";
import type { JournalAnalytics } from "./analytics";

// Pure account-health / anti-blowup indicator. Drawdown uses the FULL-history
// equity curve (not windowed) so we never understate how close they are.

export interface Health {
  status: "healthy" | "at_risk" | "critical";
  currentDrawdownPct: number;
  maxDrawdownTolerancePct: number;
  runwayTrades: number | null;
  runwaySentence: string;
  factors: string[];
  usedDefaultTolerance: boolean;
}

const DEFAULT_TOLERANCE = 15;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function accountHealth(
  trades: JournalTradeRow[],
  analytics: JournalAnalytics,
  goals: JournalGoalsRow | null,
  activeLeakCount: number
): Health {
  const tolerance = goals?.max_drawdown_pct ?? DEFAULT_TOLERANCE;
  const usedDefaultTolerance = goals?.max_drawdown_pct == null;

  // Equity series = startingBalance + cumulative closed-trade P&L (analytics
  // equityCurve holds the cumulative P&L). Find peak and current.
  const start = analytics.startingBalance ?? analytics.endingBalance ?? 0;
  let peak = start;
  let current = start;
  for (const p of analytics.equityCurve) {
    const eq = start + p.value;
    if (eq > peak) peak = eq;
    current = eq;
  }
  const currentDrawdown$ = Math.max(0, peak - current);
  const currentDrawdownPct = peak > 0 ? r2((currentDrawdown$ / peak) * 100) : 0;

  const proximity = tolerance > 0 ? currentDrawdownPct / tolerance : 0;
  const status =
    proximity > 0.85 ? "critical" : proximity >= 0.5 ? "at_risk" : "healthy";

  const avgLoss = analytics.avgLoss != null ? Math.abs(analytics.avgLoss) : 0;
  const remainingRoom = Math.max(0, (tolerance / 100) * peak - currentDrawdown$);
  const runwayTrades = avgLoss > 0 ? Math.floor(remainingRoom / avgLoss) : null;
  const runwaySentence =
    runwayTrades != null
      ? `~${runwayTrades} losing trade${runwayTrades === 1 ? "" : "s"} from your ${tolerance}% drawdown limit`
      : "Set a max-drawdown goal to see your survival runway";

  const factors = [`Drawdown ${currentDrawdownPct}% of ${tolerance}%`];
  const closed = trades
    .filter((t) => t.status === "closed" && t.close_time)
    .sort((a, b) => (a.close_time as string).localeCompare(b.close_time as string));
  if (closed.length >= 20) {
    const last10 = closed.slice(-10);
    const earlier = closed.slice(0, -10);
    const avg = (arr: JournalTradeRow[]) =>
      arr.reduce((s, t) => s + t.volume, 0) / arr.length;
    if (avg(last10) > avg(earlier) * 1.2) factors.push("Risk per trade escalating");
  }
  if (activeLeakCount > 0)
    factors.push(`${activeLeakCount} leak${activeLeakCount === 1 ? "" : "s"} active`);

  return {
    status,
    currentDrawdownPct,
    maxDrawdownTolerancePct: tolerance,
    runwayTrades,
    runwaySentence,
    factors,
    usedDefaultTolerance,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/journal/health.test.ts`
Expected: PASS (all 4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/journal/health.ts src/lib/journal/health.test.ts
git commit -m "feat(journal): account-health engine — drawdown status + survival runway"
```

---

## Task 3: Wire leaks + health into the page

**Files:** Modify `src/app/journal/page.tsx`.

- [ ] **Step 1: Add imports**

After the existing `computeAnalytics` import, add:

```ts
import { detectLeaks } from "@/lib/journal/leaks";
import { accountHealth } from "@/lib/journal/health";
```

- [ ] **Step 2: Compute leaks (90d) + health (full) before the return**

Right after the existing `const analytics = computeAnalytics(...)` block, add:

```ts
  const cf = (cashFlows ?? []) as JournalCashFlowRow[];
  const ninetyAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const trades90 = allTrades.filter(
    (t) => t.status === "closed" && t.close_time && t.close_time >= ninetyAgo
  );
  const analytics90 = computeAnalytics(trades90, cf);
  const leaks = detectLeaks(trades90, (goals ?? null) as JournalGoalsRow | null, analytics90);
  const health = accountHealth(
    allTrades,
    analytics,
    (goals ?? null) as JournalGoalsRow | null,
    leaks.leaks.length
  );
```

- [ ] **Step 3: Pass them to the dashboard**

In the `<JournalDashboard ... />` props, add `leaks={leaks}` and `health={health}` (alongside `analytics`).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (will error until Task 4 adds the props — that's fine; do Task 4 then re-run).

- [ ] **Step 5: Commit (after Task 4 typechecks)** — commit together with Task 4.

---

## Task 4: `SurvivalPanel` + dashboard wiring

**Files:** Create `src/app/journal/SurvivalPanel.tsx`; modify `src/app/journal/JournalDashboard.tsx`.

- [ ] **Step 1: Create `SurvivalPanel.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { Leak, LeakResult } from "@/lib/journal/leaks";
import type { Health } from "@/lib/journal/health";
import type { JournalTradeRow } from "@/lib/journal/types";

const STATUS: Record<Health["status"], { label: string; cls: string }> = {
  healthy: { label: "Healthy", cls: "bg-emerald-100 text-emerald-800" },
  at_risk: { label: "At risk", cls: "bg-amber-100 text-amber-800" },
  critical: { label: "Critical", cls: "bg-red-100 text-red-700" },
};
const money = (n: number) =>
  `${n < 0 ? "−" : "+"}$${Math.abs(n).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;

function LeakRow({
  leak,
  tradesById,
  big,
}: {
  leak: Leak;
  tradesById: Map<string, JournalTradeRow>;
  big?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border border-line ${big ? "bg-canvas/60 p-4" : "p-3"}`}>
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <p className={`font-semibold text-ink ${big ? "text-[16px]" : "text-[14px]"}`}>
            {leak.title}
          </p>
          <p className="text-[12px] text-subtle">
            {leak.detail}
            {leak.tier === "what_if" ? " · what-if" : ""}
          </p>
        </div>
        <span
          className={`font-bold ${big ? "text-[20px]" : "text-[15px]"} ${
            leak.dollarImpact < 0 ? "text-red-600" : "text-emerald-600"
          }`}
        >
          {money(leak.dollarImpact)}
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-1 border-t border-line pt-2 text-[12px]">
          {leak.tradeIds.map((id) => {
            const t = tradesById.get(id);
            if (!t) return null;
            return (
              <div key={id} className="flex justify-between text-subtle">
                <span>
                  {t.symbol} {t.direction} · {t.volume} lots ·{" "}
                  {t.close_time ? new Date(t.close_time).toLocaleDateString() : ""}
                </span>
                <span className={t.net_profit < 0 ? "text-red-600" : "text-emerald-600"}>
                  {money(t.net_profit)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SurvivalPanel({
  leaks,
  health,
  trades,
}: {
  leaks: LeakResult;
  health: Health;
  trades: JournalTradeRow[];
}) {
  const tradesById = new Map(trades.map((t) => [t.id, t]));
  const s = STATUS[health.status];
  const [top, ...rest] = leaks.leaks;

  return (
    <section className="rise rounded-2xl border border-line bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-ink">Survival</h2>
        <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${s.cls}`}>
          {s.label}
        </span>
      </div>
      <p className="mt-2 text-[15px] font-semibold text-ink">{health.runwaySentence}</p>
      <p className="text-[12px] text-subtle">{health.factors.join(" · ")}</p>
      {health.usedDefaultTolerance && (
        <p className="mt-1 text-[12px] text-amber-700">
          Using a default 15% limit — set your max drawdown in goals for an accurate runway.
        </p>
      )}

      <div className="mt-5">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-subtle">
          Your biggest leak
        </p>
        {top ? (
          <div className="space-y-2">
            <LeakRow leak={top} tradesById={tradesById} big />
            {rest.map((l) => (
              <LeakRow key={l.type} leak={l} tradesById={tradesById} />
            ))}
          </div>
        ) : (
          <p className="text-[14px] text-subtle">
            No money-losing patterns detected in the last 90 days. Keep it up.
          </p>
        )}
      </div>

      {leaks.strengths.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-subtle">
            What&apos;s working
          </p>
          <div className="space-y-2">
            {leaks.strengths.map((s) => (
              <LeakRow key={s.type} leak={s} tradesById={tradesById} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Wire into `JournalDashboard.tsx`**

Add imports near the top:

```tsx
import type { LeakResult } from "@/lib/journal/leaks";
import type { Health } from "@/lib/journal/health";
import { SurvivalPanel } from "./SurvivalPanel";
```

Add `leaks` + `health` to the props destructure and type:

```tsx
export function JournalDashboard({
  accounts,
  trades,
  goals,
  analytics,
  leaks,
  health,
  report,
  reportsRemaining,
  reportCap,
  currency,
}: {
  accounts: JournalAccountRow[];
  trades: JournalTradeRow[];
  goals: JournalGoalsRow | null;
  analytics: JournalAnalytics;
  leaks: LeakResult;
  health: Health;
  report: JournalReportRow | null;
  reportsRemaining: number;
  reportCap: number;
  currency: string | null;
}) {
```

Render the panel — only when there are closed trades to analyse. Immediately after
the header `</div>` that contains the "Trading Journal" title (before the accounts/
stats sections), insert:

```tsx
      {closed.length > 0 && (
        <div className="mt-6">
          <SurvivalPanel leaks={leaks} health={health} trades={trades} />
        </div>
      )}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0, build succeeds, `/journal` in the route tree.

- [ ] **Step 4: Commit (Tasks 3 + 4 together)**

```bash
git add src/app/journal/page.tsx src/app/journal/JournalDashboard.tsx src/app/journal/SurvivalPanel.tsx
git commit -m "feat(journal): Survival panel — dashboard leak/health surface"
```

---

## Task 5: Feed leaks + health into the AI coach

**Files:** Modify `src/lib/journal/coach.ts`.

- [ ] **Step 1: Add imports + extend `ReportContext`**

At the top of `coach.ts`, add:

```ts
import { detectLeaks, type LeakResult } from "./leaks";
import { accountHealth, type Health } from "./health";
```

Add two optional fields to the `ReportContext` interface:

```ts
export interface ReportContext {
  analytics: JournalAnalytics;
  signals: BehavioralSignals;
  goals: JournalGoalsRow | null;
  sampleTrades: JournalTradeRow[];
  leaks?: LeakResult;
  health?: Health;
}
```

- [ ] **Step 2: Include them in `buildReportPrompt`**

In `buildReportPrompt`, after the `BEHAVIOURAL SIGNALS:` block and before the
`THEIR OWN NOTES` line, add (using `ctx.leaks` / `ctx.health` when present):

```ts
    ctx.health
      ? `ACCOUNT HEALTH: ${ctx.health.status} · ${ctx.health.runwaySentence} · ${ctx.health.factors.join("; ")}`
      : "",
    ctx.leaks && ctx.leaks.leaks.length
      ? "QUANTIFIED LEAKS (biggest first, in $ — reference these specifically):\n" +
        ctx.leaks.leaks
          .slice(0, 3)
          .map((l) => `  • ${l.title}: ${l.dollarImpact} (${l.tier}) — ${l.detail}`)
          .join("\n")
      : "",
```

(Insert both entries into the array that `buildReportPrompt` joins with `\n`.)

- [ ] **Step 3: Compute them in `loadReportContext`**

In `loadReportContext`, after `analytics` is computed and before the `return`, add:

```ts
  const ninetyAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const trades90 = allTrades.filter(
    (t) => t.status === "closed" && t.close_time && t.close_time >= ninetyAgo
  );
  const leaks = detectLeaks(trades90, (goals ?? null) as JournalGoalsRow | null, computeAnalytics(trades90, (cashFlows ?? []) as JournalCashFlowRow[]));
  const health = accountHealth(allTrades, analytics, (goals ?? null) as JournalGoalsRow | null, leaks.leaks.length);
```

and add `leaks` + `health` to the returned `ReportContext` object.

- [ ] **Step 4: Extend the coach test**

In `src/lib/journal/coach.test.ts`, add a test that `buildReportPrompt` includes
the health + leak lines when the context carries them:

```ts
it("includes quantified leaks and health when present", () => {
  const prompt = buildReportPrompt({
    analytics: { netProfit: 0, avgWin: 100, avgLoss: -100 } as never,
    signals: {} as never,
    goals: null,
    sampleTrades: [],
    health: {
      status: "at_risk",
      runwaySentence: "~5 losing trades from your 10% drawdown limit",
      factors: ["Drawdown 5% of 10%"],
    } as never,
    leaks: {
      leaks: [
        {
          type: "revenge_trading",
          title: "Trading after losses",
          dollarImpact: -1240,
          tier: "actual",
          tradeCount: 18,
          tradeIds: [],
          detail: "18 trades after 2+ losses.",
        },
      ],
      strengths: [],
    } as never,
  });
  expect(prompt).toContain("~5 losing trades");
  expect(prompt).toContain("Trading after losses");
});
```

- [ ] **Step 5: Run coach tests + typecheck**

Run: `npx vitest run src/lib/journal/coach.test.ts && npx tsc --noEmit`
Expected: PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/journal/coach.ts src/lib/journal/coach.test.ts
git commit -m "feat(journal): coach report references quantified leaks + account health"
```

---

## Task 6: Full verification + push

- [ ] **Step 1: Full suite + build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass, build succeeds.

- [ ] **Step 2: Live smoke against the real synced account**

Run a throwaway vitest (like prior verifications) that loads the connected
account's `journal_trades` + `journal_goals` from the live DB, runs
`detectLeaks` (90d) + `accountHealth`, and logs the top leak + health so we
confirm sane real-world output before relying on it. Delete the temp test after.

- [ ] **Step 3: Push**

```bash
git push origin main
```

---

## Deferred (spec open items)

- Layer 2 (discipline rules engine + process score); Layer 3 (interventions + email).
- Trackable numeric health score.
- Structured session goal field (off-session leak detection); today off-plan =
  off-instrument only, worst_slot covers session+weekday.
- Threshold tuning (consecutive-loss count, oversize margin, overtrading count,
  outlier multiple, RR ratio, status cutoffs) against real data.
