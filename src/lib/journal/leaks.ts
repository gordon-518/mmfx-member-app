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
    if (worst && worst.net < 0 && worstKey) {
      const label = worstKey.split(":")[1];
      candidates.push({
        type: "worst_slot",
        title: `Your worst time slot (${label})`,
        dollarImpact: r2(worst.net),
        tier: "actual",
        tradeCount: worst.ids.length,
        tradeIds: worst.ids,
        detail: `${label} trades are your biggest bleed.`,
      });
    }
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
