import type { JournalTradeRow, JournalGoalsRow, JournalRulesConfig } from "./types";
import { sessionOf } from "./leaks";
import { dayKey } from "./analytics";
import { fmt } from "@/i18n/format";
import { en } from "@/i18n/messages/en";
import { sessionLabel, type JournalEngineMessages } from "./labels";

// Pure discipline-rule evaluation. Trades are already windowed (last 30d) by the
// caller so this stays deterministic (no Date). Detect + score after the fact —
// every breach links to the exact trades behind it, and the score rewards
// process (clean trading days), independent of P&L. Titles and details are in
// the reader's language (m); the rule keys are what the config stores.

export type RuleKey =
  | "max_daily_loss"
  | "max_trades_per_day"
  | "max_consec_losses"
  | "max_lots"
  | "instruments_only"
  | "allowed_sessions";

export interface Breach {
  rule: RuleKey;
  title: string;
  when: string; // ISO date (day rules) or trade close_time
  detail: string;
  tradeIds: string[];
}
export interface RuleAdherence {
  rule: RuleKey;
  title: string;
  unit: "day" | "trade";
  kept: number;
  total: number;
  breachCount: number;
  enabled: boolean;
  inert?: boolean;
}
export interface RulesResult {
  score: number | null; // % of trading days with zero breaches (null if no active rules / no trades)
  cleanDays: number;
  tradingDays: number;
  perRule: RuleAdherence[];
  breaches: Breach[]; // most recent first
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function evaluateRules(
  trades: JournalTradeRow[],
  config: JournalRulesConfig,
  goals: JournalGoalsRow | null,
  startingBalance: number | null,
  m: JournalEngineMessages = en.journalEngine
): RulesResult {
  const R = m.rules;
  const TITLES: Record<RuleKey, string> = R.titles;
  const closed = trades
    .filter((t) => t.status === "closed" && t.close_time)
    .sort((a, b) => (a.close_time as string).localeCompare(b.close_time as string));

  const byDay = new Map<string, JournalTradeRow[]>();
  for (const t of closed) {
    const d = dayKey(t.close_time as string);
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
  const dayAdherence = (rule: RuleKey) => {
    const bd = breachDaysByRule.get(rule)?.size ?? 0;
    perRule.push({
      rule,
      title: TITLES[rule],
      unit: "day",
      kept: tradingDays - bd,
      total: tradingDays,
      breachCount: bd,
      enabled: true,
    });
  };

  // 1. max_daily_loss (day)
  {
    const c = config.max_daily_loss;
    if (c?.enabled && typeof c.value === "number") {
      anyEnabled = true;
      // A percent limit needs a known starting balance. When it's unknown (no
      // BALANCE cash flow — common for credit/demo/prop accounts) do NOT fall
      // back to treating the percent as raw dollars: that turned "5%" into a $5
      // limit and fabricated a daily-loss breach almost every day (which then
      // cratered the discipline score and fired false interventions). Mark the
      // rule inert instead — it's simply not assessable without a balance.
      const inert = !!c.is_pct && !(startingBalance && startingBalance > 0);
      if (inert) {
        perRule.push({
          rule: "max_daily_loss",
          title: TITLES.max_daily_loss,
          unit: "day",
          kept: 0,
          total: tradingDays,
          breachCount: 0,
          enabled: true,
          inert: true,
        });
      } else {
        const limit = c.is_pct ? (c.value / 100) * (startingBalance as number) : c.value;
        for (const [day, arr] of byDay) {
          const net = arr.reduce((s, t) => s + t.net_profit, 0);
          if (net < -limit) {
            markDay("max_daily_loss", day);
            breaches.push({
              rule: "max_daily_loss",
              title: TITLES.max_daily_loss,
              when: day,
              detail: fmt(R.dailyLoss, { lost: r2(-net), limit: r2(limit) }),
              tradeIds: arr.map((t) => t.id),
            });
          }
        }
        dayAdherence("max_daily_loss");
      }
    }
  }

  // 2. max_trades_per_day (day)
  {
    const c = config.max_trades_per_day;
    if (c?.enabled && typeof c.value === "number") {
      anyEnabled = true;
      for (const [day, arr] of byDay) {
        if (arr.length > c.value) {
          markDay("max_trades_per_day", day);
          breaches.push({
            rule: "max_trades_per_day",
            title: TITLES.max_trades_per_day,
            when: day,
            detail: fmt(R.tradesPerDay, { n: arr.length, limit: c.value }),
            tradeIds: arr.map((t) => t.id),
          });
        }
      }
      dayAdherence("max_trades_per_day");
    }
  }

  // 3. max_consec_losses (day) — a trade taken while already on a loss streak of
  // >= value breaches (the tilt guard).
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
          breaches.push({
            rule: "max_consec_losses",
            title: TITLES.max_consec_losses,
            when: day,
            detail: fmt(R.consecLosses, { n: c.value }),
            tradeIds: triggers,
          });
        }
      }
      dayAdherence("max_consec_losses");
    }
  }

  // Trade-level rules: max_lots, instruments_only, allowed_sessions.
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
      perRule.push({
        rule: key,
        title: TITLES[key],
        unit: "trade",
        kept: 0,
        total: closed.length,
        breachCount: 0,
        enabled: true,
        inert: true,
      });
      return;
    }
    const bad = closed.filter(predicate);
    for (const t of bad) {
      markDay(key, dayKey(t.close_time as string));
      breaches.push({
        rule: key,
        title: TITLES[key],
        when: t.close_time as string,
        detail: detail(t),
        tradeIds: [t.id],
      });
    }
    perRule.push({
      rule: key,
      title: TITLES[key],
      unit: "trade",
      kept: closed.length - bad.length,
      total: closed.length,
      breachCount: bad.length,
      enabled: true,
    });
  };

  tradeRule(
    "max_lots",
    !!(config.max_lots?.enabled && typeof config.max_lots.value === "number"),
    false,
    (t) => t.volume > (config.max_lots!.value as number),
    (t) => fmt(R.maxLots, { lots: t.volume, limit: config.max_lots!.value as number })
  );

  tradeRule(
    "instruments_only",
    !!config.instruments_only?.enabled,
    instruments.length === 0,
    (t) => !instruments.includes(t.symbol.toUpperCase()),
    (t) => fmt(R.instruments, { symbol: t.symbol })
  );

  tradeRule(
    "allowed_sessions",
    !!(config.allowed_sessions?.enabled && (config.allowed_sessions.value?.length ?? 0) > 0),
    false,
    (t) => !(config.allowed_sessions!.value as string[]).includes(sessionOf(t.open_time)),
    (t) => fmt(R.session, { session: sessionLabel(sessionOf(t.open_time), m) })
  );

  const cleanDays = days.filter((d) => !anyBreachDay.has(d)).length;
  // Only score off rules that are actually being checked — an all-inert config
  // (e.g. a percent rule with no known balance, or instruments-only with no
  // instruments) can't assess discipline, so show "—" rather than a fake 100%.
  const anyActive = perRule.some((r) => r.enabled && !r.inert);
  const score = anyActive && tradingDays > 0 ? Math.round((cleanDays / tradingDays) * 100) : null;
  breaches.sort((a, b) => b.when.localeCompare(a.when));
  return { score, cleanDays, tradingDays, perRule, breaches };
}
