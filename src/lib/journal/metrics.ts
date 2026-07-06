// Headline journal stats — pure, side-effect-free, unit-tested.
// Phase 1 keeps this to the four numbers the basic dashboard shows; the full
// analytics engine (drawdown, R:R, exposure, expectancy…) lands in Phase 2
// alongside these in the same module.

import type { JournalTradeRow } from "./types";

export interface HeadlineStats {
  /** Sum of net profit across closed trades. */
  netProfit: number;
  /** Closed trades only. */
  tradeCount: number;
  /** Wins (net > 0) / closed trades; null when there are no closed trades. */
  winRate: number | null;
  /** Gross win / gross loss; null when there are no losing trades. */
  profitFactor: number | null;
}

export function headlineStats(trades: JournalTradeRow[]): HeadlineStats {
  const closed = trades.filter((t) => t.status === "closed");

  let netProfit = 0;
  let wins = 0;
  let grossWin = 0;
  let grossLoss = 0;

  for (const t of closed) {
    netProfit += t.net_profit;
    if (t.net_profit > 0) {
      wins += 1;
      grossWin += t.net_profit;
    } else if (t.net_profit < 0) {
      grossLoss += -t.net_profit;
    }
  }

  return {
    netProfit,
    tradeCount: closed.length,
    winRate: closed.length > 0 ? wins / closed.length : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
  };
}
