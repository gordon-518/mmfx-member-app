import type { JournalTradeRow, JournalGoalsRow } from "./types";
import type { JournalAnalytics } from "./analytics";
import { sessionOf as sessionForHour, dayKey } from "./analytics";

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

// Re-exported for rules.ts; delegates to the single canonical session logic.
export function sessionOf(iso: string | null): string {
  return iso ? sessionForHour(new Date(iso).getUTCHours()) : "Unknown";
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
        // what-if, not a booked loss: it assumes loss scales linearly with size,
        // so it shouldn't sit in the "real cash leaks" tier a member can dispute.
        tier: "what_if",
        tradeCount: ids.length,
        tradeIds: ids,
        detail: `Estimated extra loss from trading bigger than your ${baseline}-lot baseline after a loss.`,
      });
  }

  // 3. overtrading — days above the trade-count threshold.
  {
    const byDay = new Map<string, JournalTradeRow[]>();
    for (const tr of closed) {
      const d = dayKey(tr.close_time as string);
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

  // 5. worst_slot — worst session/weekday bucket that's a GENUINE subset (not
  // ~all the trades, and only where the dimension actually splits into buckets).
  {
    const dims: Array<(tr: JournalTradeRow) => string> = [
      (tr) => `session:${sessionOf(tr.open_time)}`,
      (tr) => `day:${WEEKDAYS[new Date(tr.close_time as string).getUTCDay()]}`,
    ];
    let best: { key: string; ids: string[]; net: number } | null = null;
    for (const keyOf of dims) {
      const buckets = new Map<string, { ids: string[]; net: number }>();
      for (const tr of closed) {
        const k = keyOf(tr);
        const b = buckets.get(k) ?? { ids: [], net: 0 };
        b.ids.push(tr.id);
        b.net += tr.net_profit;
        buckets.set(k, b);
      }
      if (buckets.size < 2) continue; // no split → not a "slot"
      for (const [k, b] of buckets) {
        if (
          b.net < 0 &&
          b.ids.length < closed.length * 0.8 && // a real subset, not everything
          (!best || b.net < best.net)
        )
          best = { key: k, ids: b.ids, net: b.net };
      }
    }
    if (best) {
      const label = best.key.split(":")[1];
      candidates.push({
        type: "worst_slot",
        title: `Your worst time slot (${label})`,
        dollarImpact: r2(best.net),
        tier: "actual",
        tradeCount: best.ids.length,
        tradeIds: best.ids,
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

  // Rank real cash leaks (actual/excess) ahead of what-if projections, so a
  // projection never headlines above money actually lost; then by $ within group.
  const tierRank = (t: Leak["tier"]) => (t === "what_if" ? 1 : 0);
  const leaks = candidates
    .filter((c) => c.dollarImpact < 0)
    .sort(
      (a, b) => tierRank(a.tier) - tierRank(b.tier) || a.dollarImpact - b.dollarImpact
    );
  const strengths = candidates
    .filter((c) => c.dollarImpact > 0)
    .sort((a, b) => b.dollarImpact - a.dollarImpact);
  return { leaks, strengths };
}
