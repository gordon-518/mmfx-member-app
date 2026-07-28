# Journal Gamified Redesign — Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rebuild `/journal` into a motivating, game-like hero experience — greeting, discipline-score ring, clean-day streak, survival + vitals, level/XP bar, weekly mission, and leaks-as-bosses — with the existing performance/history/rules/goals/coach preserved and restyled below.

**Architecture:** A new pure engine `gamification.ts` derives score/streak/XP/level deterministically from verified trades (reusing `evaluateRules` for clean-day logic). The page computes game state server-side and passes it to focused new client components. Shared formatters are extracted so all components agree. No new tables in Phase A (achievements + celebration are Phase B). Admin-only stays in force.

**Tech Stack:** Next.js App Router (server component computes, client components render), Vitest (TDD), TypeScript, Tailwind v4 with the MMFX warm-premium tokens.

**Spec:** `docs/superpowers/specs/2026-07-28-journal-gamified-redesign-design.md`

---

## Task 1: Shared formatters

**Files:** Create `src/app/journal/format.ts`.

Extract the money/pct/duration/time helpers (currently private inside
`JournalDashboard.tsx`) so every new component uses one implementation.

- [ ] **Step 1: write `format.ts`**

```ts
export function money(n: number | null | undefined, currency?: string | null): string {
  if (n == null) return "—";
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "−" : ""}${s}${currency ? ` ${currency}` : ""}`;
}

export function signedMoney(n: number, currency?: string | null): string {
  const s = Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  return `${n < 0 ? "−" : "+"}$${s}${currency ? ` ${currency}` : ""}`;
}

export function pct(frac: number | null | undefined): string {
  return frac == null ? "—" : `${(frac * 100).toFixed(1)}%`;
}

export function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function fmtDuration(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${(sec / 3600).toFixed(1)}h`;
  return `${(sec / 86400).toFixed(1)}d`;
}
```

- [ ] **Step 2: typecheck** — `npx tsc --noEmit` → exit 0.
- [ ] **Step 3: commit** — `git add src/app/journal/format.ts && git commit -m "refactor(journal): shared formatters module"`

---

## Task 2: Gamification engine (pure, TDD)

**Files:** Create `src/lib/journal/gamification.ts`, `src/lib/journal/gamification.test.ts`.

Derives streak / XP / level from verified history. Reuses `evaluateRules` over
the full trade window for clean-day logic so it always agrees with the discipline
score. `now` is passed in (deterministic).

- [ ] **Step 1: write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { computeGameState, levelForXp, xpToReachLevel, type GameInput } from "./gamification";
import type { JournalTradeRow, JournalRulesConfig } from "./types";
import { computeAnalytics } from "./analytics";

let seq = 0;
function t(o: Partial<JournalTradeRow> & { net_profit: number; day: string }): JournalTradeRow {
  seq += 1;
  return {
    id: `t${seq}`, account_id: "a", position_id: `p${seq}`, symbol: "XAUUSD", direction: "buy",
    status: "closed", volume: 0.4, open_price: 1, close_price: 1,
    open_time: `${o.day}T10:00:00.000Z`, close_time: `${o.day}T12:00:00.000Z`,
    profit: o.net_profit, commission: 0, swap: 0, duration_sec: 1,
    note: null, tags: null, emotion: null, ...o,
  };
}

const NOW = "2026-07-27T13:00:00.000Z";
function input(trades: JournalTradeRow[], config: JournalRulesConfig, over: Partial<GameInput> = {}): GameInput {
  return {
    analytics: computeAnalytics(trades, []),
    rulesConfig: config,
    goals: null,
    trades,
    now: NOW,
    ...over,
  };
}

describe("levelForXp / xpToReachLevel", () => {
  it("uses a rising curve, level 1 at 0 XP", () => {
    expect(xpToReachLevel(1)).toBe(0);
    expect(xpToReachLevel(2)).toBe(100);
    expect(xpToReachLevel(5)).toBe(1000);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(1240)).toBe(5); // 1000 ≤ 1240 < 1500
    expect(levelForXp(99)).toBe(1);
  });
});

describe("computeGameState", () => {
  const maxDaily: JournalRulesConfig = { max_daily_loss: { enabled: true, value: 200 } };

  it("streak counts consecutive clean trading days from the latest, resets on a breach", () => {
    // 3 clean days then the most recent day breaches the daily-loss rule
    const trades = [
      t({ day: "2026-07-20", net_profit: 50 }),
      t({ day: "2026-07-21", net_profit: 50 }),
      t({ day: "2026-07-22", net_profit: 50 }),
      t({ day: "2026-07-23", net_profit: -300 }), // breach: < -200
    ];
    const g = computeGameState(input(trades, maxDaily));
    expect(g.streak).toBe(0); // latest day breached
    expect(g.longestStreak).toBe(3);
  });

  it("counts a clean current streak", () => {
    const trades = [
      t({ day: "2026-07-20", net_profit: -300 }), // breach
      t({ day: "2026-07-21", net_profit: 50 }),
      t({ day: "2026-07-22", net_profit: 50 }),
    ];
    const g = computeGameState(input(trades, maxDaily));
    expect(g.streak).toBe(2);
    expect(g.longestStreak).toBe(2);
  });

  it("no rules → streak 0 and rulesSet false", () => {
    const trades = [t({ day: "2026-07-22", net_profit: 50 })];
    const g = computeGameState(input(trades, {}));
    expect(g.rulesSet).toBe(false);
    expect(g.streak).toBe(0);
  });

  it("awards XP for journaled trades, clean days and streak milestones", () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      t({ day: `2026-07-2${i + 1}`, net_profit: 50, note: i === 0 ? "logged" : null })
    );
    const g = computeGameState(input(days, maxDaily));
    // 7 clean days ×10 = 70, 1 journaled ×5 = 5, 7-day milestone +50 = 125
    expect(g.xp).toBe(125);
    expect(g.longestStreak).toBe(7);
    expect(g.level).toBe(levelForXp(125));
  });
});
```

- [ ] **Step 2: run → fail** — `npx vitest run src/lib/journal/gamification.test.ts`.

- [ ] **Step 3: implement `gamification.ts`**

```ts
import type { JournalTradeRow, JournalGoalsRow, JournalRulesConfig } from "./types";
import type { JournalAnalytics } from "./analytics";
import { evaluateRules } from "./rules";
import { isoWeek } from "./interventions";

// Pure game-state engine. Score, streak, XP and level are all derived from
// verified trade history (reusing evaluateRules for clean-day logic), so they
// are tamper-proof and recomputable. `now` is passed in (deterministic).

const CLEAN_DAY_XP = 10;
const JOURNALED_TRADE_XP = 5;
const STREAK_MILESTONES: [number, number][] = [
  [7, 50], [14, 100], [30, 250], [60, 500], [100, 1000],
];

export interface GameInput {
  analytics: JournalAnalytics;
  rulesConfig: JournalRulesConfig;
  goals: JournalGoalsRow | null;
  trades: JournalTradeRow[];
  now: string;
}

export interface GameState {
  score: number | null;      // 30d discipline score (current form)
  rulesSet: boolean;
  streak: number;            // current consecutive clean trading days
  longestStreak: number;
  cleanDaysThisWeek: number;
  tradingDaysThisWeek: number;
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

export function xpToReachLevel(level: number): number {
  return 50 * (level - 1) * level; // L1=0, L2=100, L3=300, L4=600, L5=1000 …
}
export function levelForXp(xp: number): number {
  let l = 1;
  while (xpToReachLevel(l + 1) <= xp) l += 1;
  return l;
}

function runsFrom(cleanByDay: [string, boolean][]): { current: number; longest: number } {
  // cleanByDay sorted ascending by day. current = trailing run of clean days.
  let longest = 0;
  let run = 0;
  let current = 0;
  for (let i = 0; i < cleanByDay.length; i++) {
    if (cleanByDay[i][1]) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
    current = run; // after the loop this holds the trailing run
  }
  return { current, longest };
}

export function computeGameState(inp: GameInput): GameState {
  const { trades, rulesConfig, goals, analytics, now } = inp;
  const startBal = analytics.startingBalance;

  const rulesSet = Object.values(rulesConfig).some(
    (r) => r && typeof r === "object" && (r as { enabled?: boolean }).enabled
  );

  const closed = trades
    .filter((t) => t.status === "closed" && t.close_time)
    .sort((a, b) => (a.close_time as string).localeCompare(b.close_time as string));

  // 30-day score (current form).
  const thirtyAgo = new Date(new Date(now).getTime() - 30 * 86_400_000).toISOString();
  const score = evaluateRules(
    closed.filter((t) => (t.close_time as string) >= thirtyAgo),
    rulesConfig, goals, startBal
  ).score;

  // Clean-day map over full history (reuse the rules breach logic).
  const full = evaluateRules(closed, rulesConfig, goals, startBal);
  const breachedDays = new Set(full.breaches.map((b) => b.when.slice(0, 10)));
  const tradingDays = [...new Set(closed.map((t) => (t.close_time as string).slice(0, 10)))].sort();
  const cleanByDay: [string, boolean][] = tradingDays.map((d) => [d, rulesSet && !breachedDays.has(d)]);

  const { current, longest } = runsFrom(cleanByDay);
  const streak = rulesSet ? current : 0;
  const longestStreak = rulesSet ? longest : 0;

  // This ISO week.
  const wk = isoWeek(now);
  const weekDays = cleanByDay.filter(([d]) => isoWeek(`${d}T00:00:00.000Z`) === wk);
  const tradingDaysThisWeek = weekDays.length;
  const cleanDaysThisWeek = weekDays.filter(([, clean]) => clean).length;

  // XP.
  const journaled = closed.filter((t) => t.note || t.emotion).length;
  const cleanTotal = cleanByDay.filter(([, clean]) => clean).length;
  let xp = journaled * JOURNALED_TRADE_XP + cleanTotal * CLEAN_DAY_XP;
  for (const [threshold, value] of STREAK_MILESTONES) {
    if (longestStreak >= threshold) xp += value;
  }

  const level = levelForXp(xp);
  const xpIntoLevel = xp - xpToReachLevel(level);
  const xpForNextLevel = xpToReachLevel(level + 1) - xpToReachLevel(level);

  return {
    score, rulesSet, streak, longestStreak,
    cleanDaysThisWeek, tradingDaysThisWeek,
    xp, level, xpIntoLevel, xpForNextLevel,
  };
}
```

- [ ] **Step 4: run → pass** — `npx vitest run src/lib/journal/gamification.test.ts`.
- [ ] **Step 5: commit** — `git add src/lib/journal/gamification.ts src/lib/journal/gamification.test.ts && git commit -m "feat(journal): gamification engine — streak, XP, level"`

---

## Task 3: Count-up hook

**Files:** Create `src/app/journal/useCountUp.ts`.

- [ ] **Step 1: write it** (respects reduced motion; used by the ring + XP bar)

```ts
"use client";
import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, durationMs]);
  return value;
}
```

- [ ] **Step 2: commit** — `git add src/app/journal/useCountUp.ts && git commit -m "feat(journal): count-up animation hook"`

---

## Task 4: `JournalHero` (ring + streak + survival + vitals)

**Files:** Create `src/app/journal/JournalHero.tsx`.

- [ ] **Step 1: write it**

```tsx
"use client";

import { useCountUp } from "./useCountUp";
import { signedMoney, pct } from "./format";
import type { GameState } from "@/lib/journal/gamification";
import type { Health } from "@/lib/journal/health";
import type { JournalAnalytics } from "@/lib/journal/analytics";

const SURVIVAL: Record<Health["status"], { label: string; cls: string; icon: string }> = {
  healthy: { label: "Healthy", cls: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: "🛡" },
  at_risk: { label: "At risk", cls: "bg-amber-50 border-amber-200 text-amber-700", icon: "▲" },
  critical: { label: "Critical", cls: "bg-red-50 border-red-200 text-red-700", icon: "!" },
};

function Ring({ score }: { score: number }) {
  const v = useCountUp(score);
  const C = 2 * Math.PI * 52;
  const off = C * (1 - Math.max(0, Math.min(100, v)) / 100);
  return (
    <div className="relative h-[132px] w-[132px] shrink-0">
      <svg viewBox="0 0 120 120" className="h-[132px] w-[132px] -rotate-90">
        <circle cx="60" cy="60" r="52" fill="none" strokeWidth="12" className="stroke-line" />
        <circle cx="60" cy="60" r="52" fill="none" strokeWidth="12" strokeLinecap="round"
          stroke="#ff5a1f" strokeDasharray={C} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-extrabold leading-none text-ink">{Math.round(v)}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-subtle">Discipline</span>
      </div>
    </div>
  );
}

function Vital({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" }) {
  return (
    <div className="rounded-2xl border border-line bg-paper/60 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-subtle">{label}</p>
      <p className={`mt-1 font-display text-lg font-extrabold ${tone === "up" ? "text-emerald-600" : "text-ink"}`}>{value}</p>
      {sub && <p className="text-[11px] text-subtle">{sub}</p>}
    </div>
  );
}

export function JournalHero({
  game, health, analytics, monthNet, monthCount, currency,
}: {
  game: GameState;
  health: Health;
  analytics: JournalAnalytics;
  monthNet: number;
  monthCount: number;
  currency: string | null;
}) {
  const s = SURVIVAL[health.status];
  return (
    <section className="rise rounded-3xl border border-line bg-card p-6 shadow-soft">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex shrink-0 flex-col items-center">
          <Ring score={game.score ?? 0} />
          {game.rulesSet ? (
            <div className="mt-2.5 flex items-center gap-1.5 rounded-full border border-[#ffd9c7] bg-[#fff4ef] px-3 py-1 text-[12px] font-bold text-accent-ink">
              <span aria-hidden>🔥</span>
              {game.streak}-day clean streak
            </div>
          ) : (
            <a href="/journal#rules" className="mt-2.5 rounded-full border border-line-strong px-3 py-1 text-[12px] font-semibold text-ink">
              Set rules to start your streak →
            </a>
          )}
        </div>

        <div className="grid flex-1 grid-cols-2 gap-2.5 sm:grid-cols-3">
          <div className={`rounded-2xl border p-3 ${s.cls}`}>
            <p className="text-[11px] font-bold uppercase tracking-wider">Survival</p>
            <p className="mt-1 font-display text-lg font-extrabold">{s.label}</p>
            <p className="text-[11px] opacity-80">{health.runwaySentence}</p>
          </div>
          <Vital label="Win rate" value={pct(analytics.winRate)}
            sub={analytics.profitFactor == null ? undefined : `PF ${analytics.profitFactor.toFixed(2)}`} />
          <Vital label="This month" value={signedMoney(monthNet, currency)} sub={`${monthCount} trades`}
            tone={monthNet > 0 ? "up" : undefined} />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: typecheck** — `npx tsc --noEmit` → exit 0.
- [ ] **Step 3: commit** — `git add src/app/journal/JournalHero.tsx && git commit -m "feat(journal): hero band — discipline ring, streak, survival, vitals"`

---

## Task 5: `LevelBar`

**Files:** Create `src/app/journal/LevelBar.tsx`.

- [ ] **Step 1: write it**

```tsx
"use client";

import { useCountUp } from "./useCountUp";
import type { GameState } from "@/lib/journal/gamification";

export function LevelBar({ game }: { game: GameState }) {
  const filled = useCountUp(game.xpForNextLevel ? game.xpIntoLevel / game.xpForNextLevel : 0, 800);
  return (
    <section className="rise rounded-2xl border border-line bg-card p-4 shadow-soft">
      <div className="flex items-center gap-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink font-display text-lg font-extrabold text-orange">
          {game.level}
        </div>
        <div className="flex-1">
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] font-bold text-ink">Level {game.level}</span>
            <span className="text-[12px] text-subtle">
              {game.xpIntoLevel.toLocaleString()} / {game.xpForNextLevel.toLocaleString()} XP
            </span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-orange transition-none" style={{ width: `${Math.round(filled * 100)}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: typecheck + commit** — `npx tsc --noEmit` then `git add src/app/journal/LevelBar.tsx && git commit -m "feat(journal): level + XP progress bar"`

---

## Task 6: `MissionCard` + `LeaksToBeat`

**Files:** Create `src/app/journal/MissionCard.tsx`, `src/app/journal/LeaksToBeat.tsx`.

- [ ] **Step 1: `MissionCard.tsx`** — the weekly-focus intervention as a quest.

```tsx
import type { Intervention } from "@/lib/journal/interventions";
import type { GameState } from "@/lib/journal/gamification";

export function MissionCard({ interventions, game }: { interventions: Intervention[]; game: GameState }) {
  const mission = interventions.find((i) => i.kind === "weekly_focus");
  if (!mission) return null;
  const total = game.tradingDaysThisWeek || 5;
  const done = Math.min(game.cleanDaysThisWeek, total);
  const width = total ? Math.round((done / total) * 100) : 0;
  return (
    <section className="rise rounded-3xl bg-ink p-6 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-[280px]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-orange">This week&apos;s mission</p>
          <h3 className="mt-1.5 font-display text-lg font-bold text-white">{mission.headline.replace("This week's focus: ", "")}</h3>
          <p className="mt-1 text-[13px] text-white/70">{mission.body}</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-orange" style={{ width: `${width}%` }} />
            </div>
            <span className="whitespace-nowrap text-[12px] font-bold text-white">{done} / {total} clean days</span>
          </div>
        </div>
        <a href="/journal#rules" className="whitespace-nowrap rounded-xl bg-orange px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#f24e12]">
          View plan
        </a>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: `LeaksToBeat.tsx`** — leaks as bosses, expandable to trades (replaces the leak list in `SurvivalPanel`).

```tsx
"use client";

import { useState } from "react";
import { signedMoney } from "./format";
import type { Leak, LeakResult } from "@/lib/journal/leaks";
import type { JournalTradeRow } from "@/lib/journal/types";

function LeakRow({ leak, tradesById }: { leak: Leak; tradesById: Map<string, JournalTradeRow> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-line bg-card p-3.5 shadow-soft">
      <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen((o) => !o)}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">◆</span>
        <span className="flex-1">
          <span className="block text-[14px] font-bold text-ink">{leak.title}</span>
          <span className="block text-[12px] text-subtle">{leak.detail}{leak.tier === "what_if" ? " · what-if" : ""}</span>
        </span>
        <span className={`shrink-0 text-right font-display text-[15px] font-extrabold ${leak.dollarImpact < 0 ? "text-red-600" : "text-emerald-600"}`}>
          {signedMoney(leak.dollarImpact)}
        </span>
      </button>
      {open && (
        <div className="mt-2.5 space-y-1 border-t border-line pt-2 text-[12px]">
          {leak.tradeIds.map((id) => {
            const tr = tradesById.get(id);
            if (!tr) return null;
            return (
              <div key={id} className="flex justify-between text-subtle">
                <span>{tr.symbol} {tr.direction} · {tr.volume} lots · {tr.close_time ? new Date(tr.close_time).toLocaleDateString() : ""}</span>
                <span className={tr.net_profit < 0 ? "text-red-600" : "text-emerald-600"}>{signedMoney(tr.net_profit)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LeaksToBeat({ leaks, trades }: { leaks: LeakResult; trades: JournalTradeRow[] }) {
  if (!leaks.leaks.length) return null;
  const tradesById = new Map(trades.map((t) => [t.id, t]));
  const recoverable = leaks.leaks.filter((l) => l.tier !== "what_if").reduce((s, l) => s + l.dollarImpact, 0);
  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between px-1">
        <h2 className="font-display text-lg font-bold text-ink">Leaks to beat</h2>
        {recoverable < 0 && (
          <p className="text-[12px] text-subtle">Fix all → recover <strong className="text-accent-ink">{signedMoney(-recoverable)}</strong></p>
        )}
      </div>
      <div className="space-y-2">
        {leaks.leaks.map((l) => <LeakRow key={l.type} leak={l} tradesById={tradesById} />)}
      </div>
      {leaks.strengths.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 px-1 text-[12px] font-bold uppercase tracking-wider text-subtle">What&apos;s working</p>
          <div className="space-y-2">
            {leaks.strengths.map((st) => <LeakRow key={st.type} leak={st} tradesById={tradesById} />)}
          </div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: typecheck + commit** — `npx tsc --noEmit` then `git add src/app/journal/MissionCard.tsx src/app/journal/LeaksToBeat.tsx && git commit -m "feat(journal): weekly mission card + leaks-to-beat"`

---

## Task 7: `RulesCard` (extract the rules editor)

**Files:** Create `src/app/journal/RulesCard.tsx`; the editor currently lives in `DisciplinePanel.tsx`.

Preserve the rule-editing functionality: move the `RulesEditor` + per-rule
adherence + breach log out of `DisciplinePanel` into a standalone `RulesCard`
(same behaviour — PUT `/api/journal/rules` then `router.refresh()`). The discipline
score itself now lives in the hero ring, so `RulesCard` shows the rules editor,
per-rule adherence, and the breach log (no big score dial).

- [ ] **Step 1:** copy `DisciplinePanel.tsx` to `RulesCard.tsx`; rename the exported
  component to `RulesCard`; keep `id="discipline"` on the outer `<section>` and ALSO
  add `id="rules"` (both anchors are linked from the hero/mission). Remove the
  `ScoreDial` + the big score header block (the `hasScore` score display); keep the
  header (`Discipline rules` title + Edit/Set toggle), the `perRule` adherence rows,
  the breach log, and the full `RulesEditor`. Keep the same props
  (`rules`, `config`, `trades`).

- [ ] **Step 2: typecheck + commit** — `npx tsc --noEmit` then `git add src/app/journal/RulesCard.tsx && git commit -m "feat(journal): standalone rules card (editor + adherence + breaches)"`

---

## Task 8: Recompose `JournalDashboard` + page wiring

**Files:** Modify `src/app/journal/JournalDashboard.tsx`, `src/app/journal/page.tsx`. Delete `src/app/journal/SurvivalPanel.tsx` and `src/app/journal/DisciplinePanel.tsx` once unused.

- [ ] **Step 1: page — compute game state + month stats.** In `page.tsx` add:

```ts
import { computeGameState } from "@/lib/journal/gamification";
```
After `interventions` is computed:
```ts
  const game = computeGameState({
    analytics, rulesConfig, goals: (goals ?? null) as JournalGoalsRow | null,
    trades: allTrades, now: new Date().toISOString(),
  });
  const monthStart = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthClosed = allTrades.filter(
    (t) => t.status === "closed" && t.close_time && (t.close_time as string).slice(0, 7) === monthStart
  );
  const monthNet = monthClosed.reduce((s, t) => s + t.net_profit, 0);
```
Pass `game={game}`, `monthNet={monthNet}`, `monthCount={monthClosed.length}` to `<JournalDashboard>`.

- [ ] **Step 2: JournalDashboard imports + props.** Replace the `SurvivalPanel`/`DisciplinePanel` imports with:

```ts
import { JournalHero } from "./JournalHero";
import { LevelBar } from "./LevelBar";
import { MissionCard } from "./MissionCard";
import { LeaksToBeat } from "./LeaksToBeat";
import { RulesCard } from "./RulesCard";
import type { GameState } from "@/lib/journal/gamification";
import { money, pct, fmtTime, fmtDuration } from "./format";
```
Remove the now-duplicated local `money`/`pct`/`fmtTime`/`fmtDuration` definitions in `JournalDashboard.tsx` (use the imports). Add to the props type: `game: GameState; monthNet: number; monthCount: number;` and destructure them.

- [ ] **Step 3: JournalDashboard — the new top-of-page stack.** Replace the existing
  survival/discipline block:

```tsx
      {closed.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SurvivalPanel leaks={leaks} health={health} trades={trades} />
          <DisciplinePanel rules={rules} config={rulesConfig} trades={trades} />
        </div>
      )}
```
with the game-like hero stack (placed right after `<InterventionBanner />`, replacing the `<div className="rise">` greeting header too):

```tsx
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-wider text-orange">Trading Journal</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">
            {greeting()}{profileName ? `, ${profileName}` : ""}
          </h1>
        </div>
        <p className="text-right text-[12px] text-subtle">
          {accounts[0]?.last_synced_at ? `Synced ${fmtTime(accounts[0].last_synced_at)}` : "Not synced"}<br />
          {closed.length} trades
        </p>
      </div>

      {closed.length > 0 && (
        <div className="space-y-4">
          <JournalHero game={game} health={health} analytics={analytics}
            monthNet={monthNet} monthCount={monthCount} currency={currency} />
          <LevelBar game={game} />
          <MissionCard interventions={interventions} game={game} />
          <LeaksToBeat leaks={leaks} trades={trades} />
        </div>
      )}
```
Add a `greeting()` helper at the top of the file:
```ts
function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
```
Add `profileName` to props (`profileName: string | null`) and pass it from the page:
in `page.tsx`, `profileName={(profile.full_name ?? profile.email ?? "").split(" ")[0] || null}` — confirm `requireFull()` returns `full_name`; if not, pass `profile.email` prefix. Keep the old descriptive subtitle paragraph deleted (the hero replaces it).

- [ ] **Step 4: demote the rest into a "Performance" section.** Wrap the existing KPI
  grid + charts + breakdowns under a section heading, and render `RulesCard` in the
  lower stack next to `GoalsCard`. Immediately before the KPI-grid `<div className="grid grid-cols-2 …">` add:

```tsx
          <h2 className="mt-2 font-display text-xl font-bold text-ink">Performance</h2>
```
And in the lower content (where `GoalsCard` is rendered) add, before it:

```tsx
          {closed.length > 0 && <RulesCard rules={rules} config={rulesConfig} trades={trades} />}
```
Leave the CoachCard, account cards, open positions, and trade table as-is (they
already use the tokens; they now read as the quieter lower half).

- [ ] **Step 5: delete the retired panels** — once the app builds without them:
  `git rm src/app/journal/SurvivalPanel.tsx src/app/journal/DisciplinePanel.tsx`.

- [ ] **Step 6: typecheck + build** — `npx tsc --noEmit && npm run build` → exit 0. Fix any missing-prop / unused-import errors surfaced.

- [ ] **Step 7: commit** — `git add -A && git commit -m "feat(journal): gamified hero redesign — recompose dashboard"`

---

## Task 9: Verify, live smoke, push

- [ ] **Step 1: full suite** — `npx vitest run && npx tsc --noEmit && npm run build` → all pass.
- [ ] **Step 2: live smoke** (temp script like prior layers): load the real user's trades + rules + goals, run `computeGameState`, log score/streak/longestStreak/xp/level/cleanDaysThisWeek. Confirm sensible values (976-trade account). Delete the temp script.
- [ ] **Step 3: browser check** — run the dev server (`.claude/launch.json` or `npm run dev`), open `/journal` as admin, confirm: hero ring animates, streak/level/mission/leaks render, rules editor still saves (PUT), notes still save, no console errors. (If auth-gated locally, at minimum confirm `npm run build` + the smoke; note in the commit that visual QA is pending a deployed check.)
- [ ] **Step 4: push** — `git push origin main`.

---

## Preserved functionality checklist (must still work after Phase A)

- Rules editor saves (now in `RulesCard`) · goals edit · AI coach generate · trade
  notes/tags/emotion save · account connect/sync/disconnect · intervention banner ·
  all charts + breakdowns + full trade history.

## Deferred to Phase B

Achievements catalog + shelf, `journal_game_state` table + `/api/journal/game/ack`,
`diffForCelebration`, the celebration toast, weekly-mission-completion XP.
