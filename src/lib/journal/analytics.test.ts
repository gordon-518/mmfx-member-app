import { describe, expect, it } from "vitest";
import {
  computeAnalytics,
  dayKey,
  histogram,
  sessionOf,
  weekdayOf,
} from "./analytics";
import type { JournalCashFlowRow, JournalTradeRow } from "./types";

function trade(
  o: Partial<JournalTradeRow> & {
    net_profit: number;
    open_time: string;
    close_time: string | null;
  }
): JournalTradeRow {
  return {
    id: Math.random().toString(36).slice(2),
    account_id: "a",
    position_id: "p" + Math.random().toString(36).slice(2),
    symbol: "XAUUSD",
    direction: "buy",
    status: o.close_time ? "closed" : "open",
    volume: 1,
    open_price: 2400,
    close_price: o.close_time ? 2410 : null,
    profit: o.net_profit,
    commission: 0,
    swap: 0,
    duration_sec: 3600,
    note: null,
    tags: null,
    emotion: null,
    ...o,
  };
}

const T = (h: number) => `2026-07-01T${String(h).padStart(2, "0")}:00:00.000Z`;

describe("win rate + profit factor edge cases", () => {
  it("win rate excludes break-even trades from the denominator", () => {
    const trades = [
      trade({ net_profit: 100, open_time: T(1), close_time: T(2) }), // win
      trade({ net_profit: -50, open_time: T(3), close_time: T(4) }), // loss
      trade({ net_profit: 0, open_time: T(5), close_time: T(6) }), // scratch
    ];
    const a = computeAnalytics(trades, []);
    expect(a.winRate).toBe(0.5); // 1 win / 2 decisive, not 1/3
  });

  it("all wins → profitFactor null but grossWin > 0 (label renders ∞)", () => {
    const trades = [trade({ net_profit: 100, open_time: T(1), close_time: T(2) })];
    const a = computeAnalytics(trades, []);
    expect(a.profitFactor).toBeNull();
    expect(a.grossWin).toBeGreaterThan(0);
  });
});

describe("dayKey (SGT-offset calendar day)", () => {
  it("buckets a late-UTC trade into the trader's next local day", () => {
    expect(dayKey("2026-07-27T10:00:00.000Z")).toBe("2026-07-27"); // 18:00 SGT
    expect(dayKey("2026-07-27T18:00:00.000Z")).toBe("2026-07-28"); // 02:00 SGT next day
    expect(dayKey("2026-07-28")).toBe("2026-07-28"); // a plain day key passes through
  });
});

describe("startingBalance uses the earliest-OPENED trade", () => {
  it("excludes a deposit made after trading began (not first-to-close)", () => {
    // A opens Jan 1, closes Mar 1; B opens Feb 1, closes Feb 15 (first to CLOSE).
    const trades = [
      trade({ net_profit: 100, open_time: "2026-01-01T00:00:00.000Z", close_time: "2026-03-01T00:00:00.000Z" }),
      trade({ net_profit: 50, open_time: "2026-02-01T00:00:00.000Z", close_time: "2026-02-15T00:00:00.000Z" }),
    ];
    const cf: JournalCashFlowRow[] = [
      { id: "d1", account_id: "a", deal_id: "1", amount: 1000, time: "2026-01-01T00:00:00.000Z", comment: null },
      { id: "d2", account_id: "a", deal_id: "2", amount: 500, time: "2026-01-15T00:00:00.000Z", comment: null },
    ];
    // Only the Jan 1 deposit is at/before the earliest OPEN (Jan 1). The old bug
    // used B's open (Feb 1) and wrongly folded in the Jan 15 deposit → 1500.
    expect(computeAnalytics(trades, cf).startingBalance).toBe(1000);
  });
});

describe("computeAnalytics starting-balance fallback", () => {
  it("derives startingBalance from currentBalance when there are no cash flows", () => {
    const trades = [
      trade({ net_profit: -600, open_time: T(1), close_time: T(2) }),
      trade({ net_profit: -400, open_time: T(3), close_time: T(4) }),
    ];
    const a = computeAnalytics(trades, [], { currentBalance: 250000 });
    expect(a.startingBalance).toBe(251000); // 250000 − (−1000)
    expect(a.maxDrawdownPct).not.toBeNull();
    expect(a.maxDrawdownPct! < 0.01).toBe(true); // small % of real equity, not inflated
  });

  it("no balance and no cash flows → startingBalance null (no fabricated %)", () => {
    const trades = [trade({ net_profit: -600, open_time: T(1), close_time: T(2) })];
    const a = computeAnalytics(trades, []);
    expect(a.startingBalance).toBeNull();
    expect(a.maxDrawdownPct).toBeNull();
  });

  it("ignores a currentBalance that would make the base non-positive", () => {
    // netProfit +5000 but current balance only 3000 (profits withdrawn) → base ≤ 0
    const trades = [trade({ net_profit: 5000, open_time: T(1), close_time: T(2) })];
    const a = computeAnalytics(trades, [], { currentBalance: 3000 });
    expect(a.startingBalance).toBeNull();
  });
});

describe("sessionOf", () => {
  it("buckets UTC hours into the 3 canonical forex sessions", () => {
    expect(sessionOf(3)).toBe("Asian");
    expect(sessionOf(10)).toBe("London");
    expect(sessionOf(15)).toBe("New York");
    expect(sessionOf(21)).toBe("New York"); // was "Off-hours" — now agrees with rules/leaks
    expect(sessionOf(22)).toBe("Asian");
    expect(sessionOf(2)).toBe("Asian");
  });
});

describe("weekdayOf", () => {
  it("returns the short weekday name in the SGT-offset local day", () => {
    // 10:00 UTC Wed → 18:00 SGT Wed
    expect(weekdayOf("2026-07-01T10:00:00.000Z")).toBe("Wed");
    expect(weekdayOf("2026-07-03T10:00:00.000Z")).toBe("Fri");
  });
});

describe("histogram", () => {
  it("returns [] for no values", () => {
    expect(histogram([], 6)).toEqual([]);
  });

  it("bins values into evenly-spaced buckets covering every value", () => {
    const bins = histogram([100, -50, 30], 6);
    expect(bins).toHaveLength(6);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(3);
    // width = 150/6 = 25; -50 in first bin, 30 in [25,50), 100 in last bin
    expect(bins[0].count).toBe(1);
    expect(bins[5].count).toBe(1);
  });

  it("puts identical values in a single bin", () => {
    const bins = histogram([5, 5, 5], 6);
    expect(bins).toHaveLength(1);
    expect(bins[0].count).toBe(3);
  });
});

describe("computeAnalytics", () => {
  const cashFlows: JournalCashFlowRow[] = [
    {
      id: "cf1",
      account_id: "a",
      deal_id: "d0",
      amount: 10000,
      time: "2026-06-30T09:00:00.000Z",
      comment: "Deposit",
    },
  ];
  const trades: JournalTradeRow[] = [
    trade({
      symbol: "XAUUSD",
      volume: 1,
      open_price: 2400,
      net_profit: 100,
      open_time: T(10),
      close_time: T(12),
    }),
    trade({
      symbol: "EURUSD",
      direction: "sell",
      volume: 0.5,
      open_price: 1.1,
      net_profit: -50,
      open_time: T(13),
      close_time: T(14),
    }),
    trade({
      symbol: "XAUUSD",
      volume: 2,
      open_price: 2420,
      net_profit: 30,
      open_time: T(15),
      close_time: T(16),
    }),
  ];

  it("computes headline performance metrics", () => {
    const a = computeAnalytics(trades, cashFlows);
    expect(a.closedCount).toBe(3);
    expect(a.netProfit).toBe(80);
    expect(a.winRate).toBeCloseTo(2 / 3);
    expect(a.grossWin).toBe(130);
    expect(a.grossLoss).toBe(50);
    expect(a.profitFactor).toBeCloseTo(2.6);
    expect(a.avgWin).toBeCloseTo(65);
    expect(a.avgLoss).toBeCloseTo(50);
    expect(a.payoffRatio).toBeCloseTo(1.3);
    expect(a.expectancy).toBeCloseTo(80 / 3);
    expect(a.largestWin).toBe(100);
    expect(a.largestLoss).toBe(-50);
  });

  it("builds a cumulative-P&L equity curve and max drawdown", () => {
    const a = computeAnalytics(trades, cashFlows);
    // cumulative after each closed trade in close-time order: 100, 50, 80
    expect(a.equityCurve.at(-1)?.value).toBe(80);
    expect(a.maxDrawdown).toBe(50); // peak 100 → trough 50
    expect(a.startingBalance).toBe(10000);
    expect(a.maxDrawdownPct).toBeCloseTo(50 / 10100);
  });

  it("computes streaks over close-time order", () => {
    const a = computeAnalytics(trades, cashFlows);
    expect(a.longestWinStreak).toBe(1);
    expect(a.longestLossStreak).toBe(1);
    expect(a.currentStreak).toBe(1); // last trade was a win
  });

  it("computes exposure proxies", () => {
    const a = computeAnalytics(trades, cashFlows);
    expect(a.avgLots).toBeCloseTo((1 + 0.5 + 2) / 3);
    expect(a.maxConcurrentOpen).toBe(1); // none overlap
  });

  it("breaks results down by symbol", () => {
    const a = computeAnalytics(trades, cashFlows);
    const gold = a.bySymbol.find((s) => s.symbol === "XAUUSD");
    const eur = a.bySymbol.find((s) => s.symbol === "EURUSD");
    expect(gold).toMatchObject({ count: 2, netProfit: 130, winRate: 1 });
    expect(eur).toMatchObject({ count: 1, netProfit: -50, winRate: 0 });
  });

  it("detects the max number of concurrently open trades", () => {
    const overlapping: JournalTradeRow[] = [
      trade({ net_profit: 10, open_time: T(10), close_time: T(14) }),
      trade({ net_profit: 10, open_time: T(11), close_time: T(13) }),
      trade({ net_profit: 10, open_time: T(12), close_time: T(16) }),
    ];
    expect(computeAnalytics(overlapping, []).maxConcurrentOpen).toBe(3);
  });

  it("returns a safe empty shape when there are no closed trades", () => {
    const a = computeAnalytics([], []);
    expect(a.closedCount).toBe(0);
    expect(a.netProfit).toBe(0);
    expect(a.winRate).toBeNull();
    expect(a.profitFactor).toBeNull();
    expect(a.equityCurve).toEqual([]);
    expect(a.bySymbol).toEqual([]);
    expect(a.maxDrawdownPct).toBeNull();
  });
});
