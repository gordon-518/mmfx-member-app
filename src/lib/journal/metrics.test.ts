import { describe, expect, it } from "vitest";
import { headlineStats } from "./metrics";
import type { JournalTradeRow } from "./types";

function trade(
  overrides: Partial<JournalTradeRow> & { net_profit: number }
): JournalTradeRow {
  return {
    id: "t",
    account_id: "a",
    position_id: "p",
    symbol: "XAUUSD",
    direction: "buy",
    status: "closed",
    volume: 1,
    open_price: 2400,
    close_price: 2410,
    open_time: "2026-07-01T10:00:00.000Z",
    close_time: "2026-07-01T12:00:00.000Z",
    profit: overrides.net_profit,
    commission: 0,
    swap: 0,
    duration_sec: 7200,
    note: null,
    tags: null,
    emotion: null,
    ...overrides,
  };
}

describe("headlineStats", () => {
  it("returns zeros/nulls for no trades", () => {
    expect(headlineStats([])).toEqual({
      netProfit: 0,
      tradeCount: 0,
      winRate: null,
      profitFactor: null,
    });
  });

  it("computes net profit, count and win rate over closed trades only", () => {
    const stats = headlineStats([
      trade({ net_profit: 100 }),
      trade({ net_profit: -50 }),
      trade({ net_profit: 30 }),
      trade({ net_profit: 999, status: "open" }), // excluded
    ]);
    expect(stats.tradeCount).toBe(3);
    expect(stats.netProfit).toBe(80);
    expect(stats.winRate).toBeCloseTo(2 / 3);
  });

  it("does not count break-even trades as wins", () => {
    const stats = headlineStats([
      trade({ net_profit: 0 }),
      trade({ net_profit: 10 }),
    ]);
    expect(stats.winRate).toBeCloseTo(0.5);
  });

  it("computes profit factor as gross win / gross loss", () => {
    const stats = headlineStats([
      trade({ net_profit: 300 }),
      trade({ net_profit: -100 }),
      trade({ net_profit: -50 }),
    ]);
    expect(stats.profitFactor).toBeCloseTo(2);
  });

  it("returns null profit factor when there are no losses", () => {
    const stats = headlineStats([trade({ net_profit: 100 })]);
    expect(stats.profitFactor).toBeNull();
  });
});
