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
  /** False when there's no balance basis to measure drawdown % against. */
  hasEquityBasis: boolean;
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
  // equityCurve holds the cumulative P&L). Without a balance basis we CANNOT
  // express drawdown as a % — measuring it against a $0 base turned a small dip
  // into a "90%+ drawdown" (the credit/demo-account inflation bug). analytics
  // now derives startingBalance from the account balance, so this is rarely
  // null; when it genuinely is, we report no % rather than a fabricated one.
  const start = analytics.startingBalance ?? analytics.endingBalance;
  const hasEquityBasis = start != null && start > 0;
  const base = hasEquityBasis ? (start as number) : 0;
  let peak = base;
  let current = base;
  for (const p of analytics.equityCurve) {
    const eq = base + p.value;
    if (eq > peak) peak = eq;
    current = eq;
  }
  const currentDrawdown$ = Math.max(0, peak - current);
  const currentDrawdownPct =
    hasEquityBasis && peak > 0 ? Math.min(100, r2((currentDrawdown$ / peak) * 100)) : 0;

  const proximity = hasEquityBasis && tolerance > 0 ? currentDrawdownPct / tolerance : 0;
  const status =
    proximity > 0.85 ? "critical" : proximity >= 0.5 ? "at_risk" : "healthy";

  const avgLoss = analytics.avgLoss != null ? Math.abs(analytics.avgLoss) : 0;
  const remainingRoom = Math.max(0, (tolerance / 100) * peak - currentDrawdown$);
  const runwayTrades =
    hasEquityBasis && avgLoss > 0 ? Math.floor(remainingRoom / avgLoss) : null;
  const runwaySentence = !hasEquityBasis
    ? "We’ll show your survival runway once your account balance syncs."
    : runwayTrades != null
      ? `~${runwayTrades} losing trade${runwayTrades === 1 ? "" : "s"} from your ${tolerance}% drawdown limit`
      : "Set a max-drawdown goal to see your survival runway";

  const factors = hasEquityBasis
    ? [`Drawdown ${currentDrawdownPct}% of ${tolerance}%`]
    : [];
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
    hasEquityBasis,
  };
}
