# Survival Engine — Layer 2 (Discipline Rules Engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let a trader set discipline rules; detect breaches from verified data and produce a P&L-independent discipline score + breach log, surfaced on the dashboard and fed to the coach.

**Architecture:** Pure TDD engine `rules.ts` (6 rules → score/perRule/breaches) mirroring `leaks.ts`. New `journal_rules` table (jsonb config, own-row RLS, mirrors `journal_goals`) with a GET/PUT API. A rules editor + Discipline card on the journal dashboard; score + breaches wired into the coach prompt. Admin-only.

**Spec:** `docs/superpowers/specs/2026-07-24-survival-engine-discipline-rules.md`

---

## Task 1: `journal_rules` table + RLS

**Files:** Create `supabase/migrations/20260724000002_journal_rules.sql`, `scripts/apply-journal-rules-migration.mjs`.

- [ ] **Step 1: migration SQL**

```sql
-- Discipline rules — one row per user, jsonb config so new rules need no
-- migration. Own-row RLS, mirroring journal_goals.
create table if not exists public.journal_rules (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  config     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.journal_rules enable row level security;
create policy "journal_rules_all_own"
  on public.journal_rules for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

- [ ] **Step 2: apply script** (copy `scripts/apply-ib-attribution-migration.mjs`, change the migration filename to `20260724000002_journal_rules.sql`, and change the final query to `select count(*) from public.journal_rules`).

- [ ] **Step 3: apply** — `node scripts/apply-journal-rules-migration.mjs` → prints the count (0) and "applied".

- [ ] **Step 4: commit** — `git add supabase/migrations/20260724000002_journal_rules.sql scripts/apply-journal-rules-migration.mjs && git commit -m "feat(journal): journal_rules table + own-row RLS"`

---

## Task 2: Types

**Files:** Modify `src/lib/journal/types.ts` (append).

- [ ] **Step 1: append**

```ts
// --- Discipline rules (Survival Engine Layer 2) -----------------------------

export interface RuleCfg { enabled?: boolean; value?: number; is_pct?: boolean }
export interface SessionRuleCfg { enabled?: boolean; value?: string[] }

export interface JournalRulesConfig {
  max_daily_loss?: RuleCfg;
  max_trades_per_day?: RuleCfg;
  max_consec_losses?: RuleCfg;
  max_lots?: RuleCfg;
  instruments_only?: { enabled?: boolean };
  allowed_sessions?: SessionRuleCfg;
}

export interface JournalRulesRow {
  user_id: string;
  config: JournalRulesConfig;
  updated_at: string;
}
```

- [ ] **Step 2: commit** — `git add src/lib/journal/types.ts && git commit -m "feat(journal): discipline rule config types"`

---

## Task 3: Pure rules engine (`rules.ts`) — TDD

**Files:** Create `src/lib/journal/rules.ts`, `src/lib/journal/rules.test.ts`. Export `sessionOf` from `leaks.ts` for reuse.

- [ ] **Step 1: export `sessionOf` from `leaks.ts`** — change `function sessionOf(` to `export function sessionOf(`.

- [ ] **Step 2: failing test**

```ts
import { describe, expect, it } from "vitest";
import { evaluateRules } from "./rules";
import type { JournalTradeRow, JournalRulesConfig } from "./types";

let seq = 0;
function t(o: Partial<JournalTradeRow> & { net_profit: number; day: string }): JournalTradeRow {
  seq += 1;
  return { id:`t${seq}`, account_id:"a", position_id:`p${seq}`, symbol:"XAUUSD", direction:"buy",
    status:"closed", volume:0.4, open_price:1, close_price:1,
    open_time:`${o.day}T10:00:00.000Z`, close_time:`${o.day}T12:00:00.000Z`,
    profit:o.net_profit, commission:0, swap:0, net_profit:o.net_profit, duration_sec:1,
    note:null, tags:null, emotion:null, ...o };
}

describe("evaluateRules", () => {
  it("max_daily_loss: breaches a day below the $ limit", () => {
    const trades = [t({ day:"2026-07-01", net_profit:-150 }), t({ day:"2026-07-01", net_profit:-100 }), t({ day:"2026-07-02", net_profit:50 })];
    const cfg: JournalRulesConfig = { max_daily_loss: { enabled:true, value:200 } };
    const r = evaluateRules(trades, cfg, null, 10000);
    expect(r.breaches.filter(b=>b.rule==="max_daily_loss").length).toBe(1); // day 01: -250 < -200
    expect(r.cleanDays).toBe(1);
    expect(r.tradingDays).toBe(2);
    expect(r.score).toBe(50);
  });

  it("max_trades_per_day: breaches a day over the count", () => {
    const trades = Array.from({length:6},(_,i)=>t({ day:"2026-07-01", net_profit:10, id:`x${i}` }));
    const cfg: JournalRulesConfig = { max_trades_per_day: { enabled:true, value:5 } };
    const r = evaluateRules(trades, cfg, null, 10000);
    expect(r.breaches.some(b=>b.rule==="max_trades_per_day")).toBe(true);
    expect(r.score).toBe(0);
  });

  it("max_lots: per-trade breach with trade ids", () => {
    const trades = [t({ day:"2026-07-01", net_profit:10, id:"ok", volume:0.4 }), t({ day:"2026-07-01", net_profit:-10, id:"big", volume:2.0 })];
    const cfg: JournalRulesConfig = { max_lots: { enabled:true, value:1.0 } };
    const r = evaluateRules(trades, cfg, null, 10000);
    const b = r.breaches.find(x=>x.rule==="max_lots");
    expect(b!.tradeIds).toEqual(["big"]);
    const adh = r.perRule.find(p=>p.rule==="max_lots")!;
    expect(adh.unit).toBe("trade");
    expect(adh.kept).toBe(1);
    expect(adh.total).toBe(2);
  });

  it("instruments_only: inert without goals instruments", () => {
    const trades = [t({ day:"2026-07-01", net_profit:10, symbol:"EURUSD" })];
    const cfg: JournalRulesConfig = { instruments_only: { enabled:true } };
    const r = evaluateRules(trades, cfg, null, 10000);
    expect(r.perRule.find(p=>p.rule==="instruments_only")!.inert).toBe(true);
    expect(r.breaches.length).toBe(0);
  });

  it("instruments_only: breaches off-instrument trades", () => {
    const trades = [t({ day:"2026-07-01", net_profit:10, symbol:"EURUSD", id:"off" })];
    const cfg: JournalRulesConfig = { instruments_only: { enabled:true } };
    const r = evaluateRules(trades, cfg, { instruments:["XAUUSD"] } as never, 10000);
    expect(r.breaches.find(b=>b.rule==="instruments_only")!.tradeIds).toEqual(["off"]);
  });

  it("no active rules → score null", () => {
    const r = evaluateRules([t({ day:"2026-07-01", net_profit:10 })], {}, null, 10000);
    expect(r.score).toBeNull();
  });
});
```

- [ ] **Step 3: run → fail** — `npx vitest run src/lib/journal/rules.test.ts` (module missing).

- [ ] **Step 4: implement `rules.ts`**

```ts
import type { JournalTradeRow, JournalGoalsRow, JournalRulesConfig } from "./types";
import { sessionOf } from "./leaks";

export type RuleKey =
  | "max_daily_loss" | "max_trades_per_day" | "max_consec_losses"
  | "max_lots" | "instruments_only" | "allowed_sessions";

export interface Breach { rule: RuleKey; title: string; when: string; detail: string; tradeIds: string[] }
export interface RuleAdherence { rule: RuleKey; title: string; unit: "day" | "trade"; kept: number; total: number; breachCount: number; enabled: boolean; inert?: boolean }
export interface RulesResult { score: number | null; cleanDays: number; tradingDays: number; perRule: RuleAdherence[]; breaches: Breach[] }

const TITLES: Record<RuleKey, string> = {
  max_daily_loss: "Max daily loss",
  max_trades_per_day: "Max trades per day",
  max_consec_losses: "No trading after losses",
  max_lots: "Max position size",
  instruments_only: "Instruments only",
  allowed_sessions: "Allowed sessions",
};
const DAY_RULES: RuleKey[] = ["max_daily_loss", "max_trades_per_day", "max_consec_losses"];
const r2 = (n: number) => Math.round(n * 100) / 100;

export function evaluateRules(
  trades: JournalTradeRow[],
  config: JournalRulesConfig,
  goals: JournalGoalsRow | null,
  startingBalance: number | null
): RulesResult {
  const closed = trades
    .filter((t) => t.status === "closed" && t.close_time)
    .sort((a, b) => (a.close_time as string).localeCompare(b.close_time as string));

  const byDay = new Map<string, JournalTradeRow[]>();
  for (const t of closed) {
    const d = (t.close_time as string).slice(0, 10);
    const arr = byDay.get(d) ?? [];
    arr.push(t);
    byDay.set(d, arr);
  }
  const days = [...byDay.keys()];
  const tradingDays = days.length;
  const instruments = (goals?.instruments ?? []).map((s) => s.toUpperCase());

  const breaches: Breach[] = [];
  const perRule: RuleAdherence[] = [];
  const breachDaysByRule = new Map<RuleKey, Set<string>>();
  const anyBreachDay = new Set<string>();
  let anyEnabled = false;

  const markDay = (rule: RuleKey, day: string) => {
    const s = breachDaysByRule.get(rule) ?? new Set<string>();
    s.add(day);
    breachDaysByRule.set(rule, s);
    anyBreachDay.add(day);
  };

  // --- max_daily_loss (day) ---
  {
    const c = config.max_daily_loss;
    if (c?.enabled && typeof c.value === "number") {
      anyEnabled = true;
      const limit = c.is_pct && startingBalance ? (c.value / 100) * startingBalance : c.value;
      for (const [day, arr] of byDay) {
        const net = arr.reduce((s, t) => s + t.net_profit, 0);
        if (net < -limit) {
          markDay("max_daily_loss", day);
          breaches.push({ rule:"max_daily_loss", title:TITLES.max_daily_loss, when:day,
            detail:`Lost $${r2(-net)} vs your $${r2(limit)} limit`, tradeIds:arr.map((t)=>t.id) });
        }
      }
      const bd = breachDaysByRule.get("max_daily_loss")?.size ?? 0;
      perRule.push({ rule:"max_daily_loss", title:TITLES.max_daily_loss, unit:"day", kept:tradingDays-bd, total:tradingDays, breachCount:bd, enabled:true });
    }
  }

  // --- max_trades_per_day (day) ---
  {
    const c = config.max_trades_per_day;
    if (c?.enabled && typeof c.value === "number") {
      anyEnabled = true;
      for (const [day, arr] of byDay) {
        if (arr.length > c.value) {
          markDay("max_trades_per_day", day);
          breaches.push({ rule:"max_trades_per_day", title:TITLES.max_trades_per_day, when:day,
            detail:`${arr.length} trades vs your ${c.value} limit`, tradeIds:arr.map((t)=>t.id) });
        }
      }
      const bd = breachDaysByRule.get("max_trades_per_day")?.size ?? 0;
      perRule.push({ rule:"max_trades_per_day", title:TITLES.max_trades_per_day, unit:"day", kept:tradingDays-bd, total:tradingDays, breachCount:bd, enabled:true });
    }
  }

  // --- max_consec_losses (day) ---
  {
    const c = config.max_consec_losses;
    if (c?.enabled && typeof c.value === "number") {
      anyEnabled = true;
      for (const [day, arr] of byDay) {
        let run = 0;
        const triggers: string[] = [];
        for (const t of arr) {
          if (run >= c.value) triggers.push(t.id);
          run = t.net_profit < 0 ? run + 1 : 0;
        }
        if (triggers.length) {
          markDay("max_consec_losses", day);
          breaches.push({ rule:"max_consec_losses", title:TITLES.max_consec_losses, when:day,
            detail:`Kept trading after ${c.value} losses in a row`, tradeIds:triggers });
        }
      }
      const bd = breachDaysByRule.get("max_consec_losses")?.size ?? 0;
      perRule.push({ rule:"max_consec_losses", title:TITLES.max_consec_losses, unit:"day", kept:tradingDays-bd, total:tradingDays, breachCount:bd, enabled:true });
    }
  }

  // --- trade-level rules: max_lots, instruments_only, allowed_sessions ---
  const tradeRule = (
    key: RuleKey,
    enabled: boolean,
    inert: boolean,
    predicate: (t: JournalTradeRow) => boolean,
    detail: (t: JournalTradeRow) => string
  ) => {
    if (!enabled) return;
    anyEnabled = true;
    if (inert) {
      perRule.push({ rule:key, title:TITLES[key], unit:"trade", kept:0, total:closed.length, breachCount:0, enabled:true, inert:true });
      return;
    }
    const bad = closed.filter(predicate);
    for (const t of bad) {
      markDay(key, (t.close_time as string).slice(0, 10));
      breaches.push({ rule:key, title:TITLES[key], when:t.close_time as string, detail:detail(t), tradeIds:[t.id] });
    }
    perRule.push({ rule:key, title:TITLES[key], unit:"trade", kept:closed.length-bad.length, total:closed.length, breachCount:bad.length, enabled:true });
  };

  tradeRule("max_lots", !!(config.max_lots?.enabled && typeof config.max_lots.value === "number"), false,
    (t) => t.volume > (config.max_lots!.value as number),
    (t) => `${t.volume} lots vs your ${config.max_lots!.value} limit`);

  tradeRule("instruments_only", !!config.instruments_only?.enabled, instruments.length === 0,
    (t) => !instruments.includes(t.symbol.toUpperCase()),
    (t) => `Traded ${t.symbol}, outside your instruments`);

  tradeRule("allowed_sessions",
    !!(config.allowed_sessions?.enabled && (config.allowed_sessions.value?.length ?? 0) > 0),
    false,
    (t) => !(config.allowed_sessions!.value as string[]).includes(sessionOf(t.open_time)),
    (t) => `Traded the ${sessionOf(t.open_time)} session`);

  const cleanDays = days.filter((d) => !anyBreachDay.has(d)).length;
  const score = anyEnabled && tradingDays > 0 ? Math.round((cleanDays / tradingDays) * 100) : null;
  breaches.sort((a, b) => b.when.localeCompare(a.when));
  return { score, cleanDays, tradingDays, perRule, breaches };
}
```

- [ ] **Step 5: run → pass** — `npx vitest run src/lib/journal/rules.test.ts` (6 pass).

- [ ] **Step 6: commit** — `git add src/lib/journal/rules.ts src/lib/journal/rules.test.ts src/lib/journal/leaks.ts && git commit -m "feat(journal): discipline rules engine — breach detection + clean-day score"`

---

## Task 4: Rules API (`GET`/`PUT`)

**Files:** Create `src/app/api/journal/rules/route.ts`.

- [ ] **Step 1: write it** (mirror the goals route)

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/journal/api";
import type { JournalRulesConfig } from "@/lib/journal/types";

const SESSIONS = new Set(["London", "New York", "Asian"]);

function cleanNumRule(v: unknown): { enabled: boolean; value?: number; is_pct?: boolean } | undefined {
  if (v == null || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const value = typeof o.value === "number" && Number.isFinite(o.value) && o.value >= 0 ? o.value : undefined;
  return { enabled: !!o.enabled, value, is_pct: !!o.is_pct };
}

export async function GET() {
  const guard = await requireAdminApi();
  if ("response" in guard) return guard.response;
  const supabase = await createClient();
  const { data } = await supabase.from("journal_rules").select().maybeSingle();
  return NextResponse.json({ rules: data?.config ?? {} });
}

export async function PUT(req: NextRequest) {
  const guard = await requireAdminApi();
  if ("response" in guard) return guard.response;
  const { profile } = guard;
  let body: JournalRulesConfig;
  try { body = (await req.json()) as JournalRulesConfig; }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const sessions = Array.isArray(body.allowed_sessions?.value)
    ? body.allowed_sessions!.value.filter((s) => typeof s === "string" && SESSIONS.has(s))
    : [];

  const config: JournalRulesConfig = {
    max_daily_loss: cleanNumRule(body.max_daily_loss),
    max_trades_per_day: cleanNumRule(body.max_trades_per_day),
    max_consec_losses: cleanNumRule(body.max_consec_losses),
    max_lots: cleanNumRule(body.max_lots),
    instruments_only: { enabled: !!body.instruments_only?.enabled },
    allowed_sessions: { enabled: !!body.allowed_sessions?.enabled, value: sessions },
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("journal_rules")
    .upsert({ user_id: profile.id, config, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: config });
}
```

- [ ] **Step 2: typecheck** — `npx tsc --noEmit` → exit 0.
- [ ] **Step 3: commit** — `git add src/app/api/journal/rules/route.ts && git commit -m "feat(journal): rules GET/PUT API"`

---

## Task 5: Discipline card + rules editor + page wiring

**Files:** Create `src/app/journal/DisciplinePanel.tsx`; modify `src/app/journal/page.tsx`, `src/app/journal/JournalDashboard.tsx`.

- [ ] **Step 1: page — load rules, evaluate, pass down.** In `page.tsx` add imports `import { evaluateRules } from "@/lib/journal/rules"; import type { JournalRulesConfig } from "@/lib/journal/types";`, add `supabase.from("journal_rules").select().maybeSingle()` to the parallel fetch, and after `trades90`:

```ts
  const rulesConfig = ((rulesRow?.config ?? {}) as JournalRulesConfig);
  const rules = evaluateRules(
    allTrades.filter((t) => t.status === "closed" && t.close_time && t.close_time >= new Date(Date.now()-30*86_400_000).toISOString()),
    rulesConfig,
    (goals ?? null) as JournalGoalsRow | null,
    analytics.startingBalance
  );
```

Pass `rules={rules}` and `rulesConfig={rulesConfig}` to `<JournalDashboard>`.

- [ ] **Step 2: `DisciplinePanel.tsx`** — client card: score big, per-rule adherence rows (kept X/Y + breach count, "inert" hint), breach log expandable to trades, and an inline **rules editor** (toggle + number/session inputs per rule) that PUTs to `/api/journal/rules` then `router.refresh()`. (Follow the `SurvivalPanel.tsx` + `GoalsStep` patterns for styling and the fetch/refresh flow.)

- [ ] **Step 3: `JournalDashboard.tsx`** — add `rules`/`rulesConfig` props + types (`import type { RulesResult } from "@/lib/journal/rules"`), render `<DisciplinePanel rules={rules} config={rulesConfig} trades={trades} goals={goals} />` right after the `SurvivalPanel` block.

- [ ] **Step 4: typecheck + build** — `npx tsc --noEmit && npm run build` → exit 0.
- [ ] **Step 5: commit** — `git add src/app/journal/DisciplinePanel.tsx src/app/journal/page.tsx src/app/journal/JournalDashboard.tsx && git commit -m "feat(journal): Discipline card + rules editor on the dashboard"`

---

## Task 6: Coach integration

**Files:** Modify `src/lib/journal/coach.ts`, `src/lib/journal/coach.test.ts`.

- [ ] **Step 1:** import `evaluateRules` + `type RulesResult`; add optional `rules?: RulesResult` to `ReportContext`; in `buildReportPrompt` add a line when present: `ctx.rules && ctx.rules.score != null ? \`DISCIPLINE: ${ctx.rules.score}% clean days · breaches: ${ctx.rules.breaches.slice(0,3).map(b=>b.title).join(", ") || "none"}\` : ""`. In `loadReportContext`, fetch `journal_rules`, evaluate over the last 30d, add `rules` to the returned context.
- [ ] **Step 2:** extend `coach.test.ts` — a test that the prompt contains the discipline line when `rules: { score: 72, breaches: [...] }` is passed.
- [ ] **Step 3:** `npx vitest run src/lib/journal/coach.test.ts && npx tsc --noEmit`.
- [ ] **Step 4: commit** — `git commit -am "feat(journal): coach report references discipline score + breaches"`

---

## Task 7: Verify + push

- [ ] `npx vitest run && npx tsc --noEmit && npm run build` → all pass.
- [ ] Live smoke (temp vitest, like Layer 1): load the connected account's trades, set a sample rules config, run `evaluateRules`, log score/breaches; delete temp test.
- [ ] `git push origin main`.

---

## Deferred

- Layer 3 (real-time nudges + email). Discipline-score-over-time chart. Default rule suggestions.
