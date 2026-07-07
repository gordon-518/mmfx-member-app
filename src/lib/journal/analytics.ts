// Phase 2 analytics engine — pure, side-effect-free, unit-tested.
//
// Turns reconstructed trades + cash flows into the full set of numbers the
// "See & Measure" dashboard renders: headline performance, a cumulative-P&L
// equity curve, max drawdown, streaks, exposure proxies, a P&L histogram and
// per-symbol / per-session / per-weekday breakdowns.
//
// Honesty notes:
// - "Payoff ratio" is REALIZED avg-win / avg-loss. True planned R:R needs the
//   stop-loss distance, which MT5 deal history does not carry — so we surface
//   the realized figure and label it as such in the UI.
// - The equity curve is cumulative closed-trade P&L (starts at 0), so it
//   isolates trading performance from deposits/withdrawals. Drawdown is taken
//   on that curve; the % is relative to starting balance + peak.

import type { JournalCashFlowRow, JournalTradeRow } from "./types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Forex session for a UTC hour. Simple, labeled buckets. */
export function sessionOf(hourUtc: number): string {
  if (hourUtc < 7) return "Asian";
  if (hourUtc < 13) return "London";
  if (hourUtc < 21) return "New York";
  return "Off-hours";
}

/** Short UTC weekday name for an ISO timestamp. */
export function weekdayOf(iso: string): string {
  return WEEKDAYS[new Date(iso).getUTCDay()];
}

export interface HistogramBin {
  from: number;
  to: number;
  count: number;
}

/** Evenly-spaced histogram over `values`. Last bin is inclusive of max. */
export function histogram(values: number[], bins: number): HistogramBin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ from: min, to: max, count: values.length }];

  const width = (max - min) / bins;
  const out: HistogramBin[] = Array.from({ length: bins }, (_, i) => ({
    from: min + i * width,
    to: min + (i + 1) * width,
    count: 0,
  }));
  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx >= bins) idx = bins - 1; // max lands in the last bin
    out[idx].count += 1;
  }
  return out;
}

export interface CurvePoint {
  time: string;
  value: number;
}

export interface Breakdown {
  key: string;
  count: number;
  netProfit: number;
  winRate: number;
}

export interface SymbolBreakdown extends Breakdown {
  symbol: string;
}

export interface JournalAnalytics {
  closedCount: number;
  openCount: number;
  netProfit: number;
  winRate: number | null;
  grossWin: number;
  grossLoss: number;
  profitFactor: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  payoffRatio: number | null;
  expectancy: number | null;
  largestWin: number;
  largestLoss: number;
  avgDurationSec: number | null;
  longestWinStreak: number;
  longestLossStreak: number;
  /** Signed: positive = current win streak, negative = current loss streak. */
  currentStreak: number;
  avgLots: number | null;
  avgNotional: number | null;
  maxConcurrentOpen: number;
  startingBalance: number | null;
  endingBalance: number | null;
  /** Cumulative closed-trade P&L over close-time order. */
  equityCurve: CurvePoint[];
  /** Underwater curve: distance below the running peak (≤ 0). */
  drawdownCurve: CurvePoint[];
  maxDrawdown: number;
  maxDrawdownPct: number | null;
  pnlHistogram: HistogramBin[];
  bySymbol: SymbolBreakdown[];
  bySession: Breakdown[];
  byWeekday: Breakdown[];
}

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

function groupBreakdown(
  trades: JournalTradeRow[],
  keyOf: (t: JournalTradeRow) => string
): Breakdown[] {
  const map = new Map<string, { count: number; net: number; wins: number }>();
  for (const t of trades) {
    const k = keyOf(t);
    const g = map.get(k) ?? { count: 0, net: 0, wins: 0 };
    g.count += 1;
    g.net += t.net_profit;
    if (t.net_profit > 0) g.wins += 1;
    map.set(k, g);
  }
  return [...map.entries()]
    .map(([key, g]) => ({
      key,
      count: g.count,
      netProfit: round2(g.net),
      winRate: g.count > 0 ? g.wins / g.count : 0,
    }))
    .sort((a, b) => b.netProfit - a.netProfit);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Max number of trades open at the same instant (overlapping intervals). */
function maxConcurrent(trades: JournalTradeRow[]): number {
  const events: { t: number; delta: number }[] = [];
  for (const tr of trades) {
    if (!tr.open_time) continue;
    const open = new Date(tr.open_time).getTime();
    const close = tr.close_time
      ? new Date(tr.close_time).getTime()
      : Number.POSITIVE_INFINITY;
    events.push({ t: open, delta: 1 });
    events.push({ t: close, delta: -1 });
  }
  // Close before open at the same instant so touching trades don't count as overlapping.
  events.sort((a, b) => a.t - b.t || a.delta - b.delta);
  let cur = 0;
  let max = 0;
  for (const e of events) {
    cur += e.delta;
    if (cur > max) max = cur;
  }
  return max;
}

export function computeAnalytics(
  allTrades: JournalTradeRow[],
  cashFlows: JournalCashFlowRow[]
): JournalAnalytics {
  const closed = allTrades
    .filter((t) => t.status === "closed")
    .sort((a, b) => ms(a.close_time) - ms(b.close_time));
  const open = allTrades.filter((t) => t.status === "open");

  const netProfit = round2(closed.reduce((s, t) => s + t.net_profit, 0));
  const wins = closed.filter((t) => t.net_profit > 0);
  const losses = closed.filter((t) => t.net_profit < 0);
  const grossWin = round2(wins.reduce((s, t) => s + t.net_profit, 0));
  const grossLoss = round2(-losses.reduce((s, t) => s + t.net_profit, 0));

  const avgWin = wins.length ? grossWin / wins.length : null;
  const avgLoss = losses.length ? grossLoss / losses.length : null;
  const winRate = closed.length ? wins.length / closed.length : null;

  // Streaks over close-time order.
  let longestWin = 0;
  let longestLoss = 0;
  let runWin = 0;
  let runLoss = 0;
  for (const t of closed) {
    if (t.net_profit > 0) {
      runWin += 1;
      runLoss = 0;
    } else if (t.net_profit < 0) {
      runLoss += 1;
      runWin = 0;
    } else {
      runWin = 0;
      runLoss = 0;
    }
    longestWin = Math.max(longestWin, runWin);
    longestLoss = Math.max(longestLoss, runLoss);
  }
  const last = closed.at(-1);
  const currentStreak =
    !last || last.net_profit === 0 ? 0 : last.net_profit > 0 ? runWin : -runLoss;

  // Equity + drawdown on cumulative closed-trade P&L.
  const equityCurve: CurvePoint[] = [];
  const drawdownCurve: CurvePoint[] = [];
  let cum = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const t of closed) {
    cum = round2(cum + t.net_profit);
    peak = Math.max(peak, cum);
    const dd = round2(cum - peak);
    maxDrawdown = Math.max(maxDrawdown, peak - cum);
    const time = t.close_time ?? t.open_time ?? "";
    equityCurve.push({ time, value: cum });
    drawdownCurve.push({ time, value: dd });
  }
  maxDrawdown = round2(maxDrawdown);

  // Starting balance = deposits that landed before the first trade.
  const firstTradeAt = closed[0]?.open_time
    ? new Date(closed[0].open_time).getTime()
    : null;
  const startingBalance =
    cashFlows.length === 0
      ? null
      : round2(
          cashFlows
            .filter(
              (c) =>
                firstTradeAt === null ||
                new Date(c.time).getTime() <= firstTradeAt
            )
            .reduce((s, c) => s + c.amount, 0)
        );
  const totalDeposits = cashFlows.length
    ? round2(cashFlows.reduce((s, c) => s + c.amount, 0))
    : null;
  const endingBalance =
    totalDeposits === null ? null : round2(totalDeposits + netProfit);

  const peakBalance =
    startingBalance !== null ? startingBalance + peak : null;
  const maxDrawdownPct =
    peakBalance && peakBalance > 0 ? maxDrawdown / peakBalance : null;

  const durations = closed
    .map((t) => t.duration_sec)
    .filter((d): d is number => d != null);
  const avgDurationSec = durations.length
    ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
    : null;

  const notionals = closed
    .filter((t) => t.open_price != null)
    .map((t) => t.volume * (t.open_price as number));

  return {
    closedCount: closed.length,
    openCount: open.length,
    netProfit,
    winRate,
    grossWin,
    grossLoss,
    profitFactor: grossLoss > 0 ? round2(grossWin / grossLoss) : null,
    avgWin: avgWin === null ? null : round2(avgWin),
    avgLoss: avgLoss === null ? null : round2(avgLoss),
    payoffRatio:
      avgWin !== null && avgLoss ? round2(avgWin / avgLoss) : null,
    expectancy: closed.length ? round2(netProfit / closed.length) : null,
    largestWin: closed.length ? Math.max(...closed.map((t) => t.net_profit), 0) : 0,
    largestLoss: closed.length ? Math.min(...closed.map((t) => t.net_profit), 0) : 0,
    avgDurationSec,
    longestWinStreak: longestWin,
    longestLossStreak: longestLoss,
    currentStreak,
    avgLots: closed.length
      ? round2(closed.reduce((s, t) => s + t.volume, 0) / closed.length)
      : null,
    avgNotional: notionals.length
      ? round2(notionals.reduce((s, n) => s + n, 0) / notionals.length)
      : null,
    maxConcurrentOpen: maxConcurrent(allTrades),
    startingBalance,
    endingBalance,
    equityCurve,
    drawdownCurve,
    maxDrawdown,
    maxDrawdownPct,
    pnlHistogram: histogram(
      closed.map((t) => t.net_profit),
      9
    ),
    bySymbol: groupBreakdown(closed, (t) => t.symbol).map((b) => ({
      ...b,
      symbol: b.key,
    })),
    bySession: groupBreakdown(closed, (t) =>
      t.open_time ? sessionOf(new Date(t.open_time).getUTCHours()) : "Unknown"
    ),
    byWeekday: groupBreakdown(closed, (t) =>
      t.open_time ? weekdayOf(t.open_time) : "Unknown"
    ),
  };
}
