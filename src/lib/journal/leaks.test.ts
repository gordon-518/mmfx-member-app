import { describe, expect, it } from "vitest";
import { detectLeaks } from "./leaks";
import type { JournalTradeRow } from "./types";
import type { JournalAnalytics } from "./analytics";

let seq = 0;
function t(over: Partial<JournalTradeRow>): JournalTradeRow {
  seq += 1;
  return {
    id: `t${seq}`,
    account_id: "a",
    position_id: `p${seq}`,
    symbol: "XAUUSD",
    direction: "buy",
    status: "closed",
    volume: 0.4,
    open_price: 1,
    close_price: 1,
    open_time: `2026-07-0${((seq - 1) % 9) + 1}T10:00:00.000Z`,
    close_time: `2026-07-0${((seq - 1) % 9) + 1}T12:00:00.000Z`,
    profit: 0,
    commission: 0,
    swap: 0,
    net_profit: 0,
    duration_sec: 7200,
    note: null,
    tags: null,
    emotion: null,
    ...over,
  };
}
function analytics(over: Partial<JournalAnalytics>): JournalAnalytics {
  return {
    avgWin: 100,
    avgLoss: -100,
    netProfit: 0,
    bySession: [],
    byWeekday: [],
    ...over,
  } as JournalAnalytics;
}

describe("detectLeaks", () => {
  it("revenge_trading: sums net of trades after 2+ consecutive losses (actual)", () => {
    const trades = [
      t({ id: "L1", net_profit: -50 }),
      t({ id: "L2", net_profit: -50 }),
      t({ id: "R1", net_profit: -80 }),
      t({ id: "R2", net_profit: 30 }),
    ];
    const { leaks } = detectLeaks(trades, null, analytics({}));
    const rt = leaks.find((l) => l.type === "revenge_trading");
    expect(rt).toBeTruthy();
    expect(rt!.dollarImpact).toBe(-50);
    expect(rt!.tier).toBe("actual");
    expect(rt!.tradeIds).toEqual(["R1", "R2"]);
  });

  it("overtrading: nets trades on days above the threshold (actual)", () => {
    const trades = Array.from({ length: 6 }, (_, i) =>
      t({ id: `o${i}`, net_profit: -10, close_time: "2026-07-01T12:00:00.000Z" })
    );
    const { leaks } = detectLeaks(trades, null, analytics({}));
    const ot = leaks.find((l) => l.type === "overtrading");
    expect(ot!.dollarImpact).toBe(-60);
    expect(ot!.tradeCount).toBe(6);
  });

  it("off_plan: nets trades on instruments outside goals (actual)", () => {
    const trades = [
      t({ id: "in", symbol: "XAUUSD", net_profit: 20 }),
      t({ id: "off", symbol: "EURUSD", net_profit: -40 }),
    ];
    const { leaks } = detectLeaks(
      trades,
      { instruments: ["XAUUSD"] } as never,
      analytics({})
    );
    const op = leaks.find((l) => l.type === "off_plan");
    expect(op!.dollarImpact).toBe(-40);
    expect(op!.tradeIds).toEqual(["off"]);
  });

  it("blowup_losses: excess of outlier losses beyond typical (excess)", () => {
    const trades = [
      t({ id: "l1", net_profit: -20 }),
      t({ id: "l2", net_profit: -20 }),
      t({ id: "l3", net_profit: -20 }),
      t({ id: "big", net_profit: -200 }),
    ];
    const { leaks } = detectLeaks(trades, null, analytics({}));
    const bl = leaks.find((l) => l.type === "blowup_losses");
    expect(bl!.tier).toBe("excess");
    expect(bl!.dollarImpact).toBe(-180);
    expect(bl!.tradeIds).toEqual(["big"]);
  });

  it("skewed_rr: labelled what_if only when it would improve", () => {
    const trades = [
      t({ id: "w", net_profit: 100 }),
      t({ id: "l", net_profit: -300 }),
    ];
    const { leaks } = detectLeaks(
      trades,
      null,
      analytics({ avgWin: 100, avgLoss: -300, netProfit: -200 })
    );
    const rr = leaks.find((l) => l.type === "skewed_rr");
    expect(rr!.tier).toBe("what_if");
    expect(rr!.dollarImpact).toBe(-200);
  });

  it("classifies a profitable pattern as a strength, not a leak", () => {
    const trades = [
      t({ id: "L1", net_profit: -50 }),
      t({ id: "L2", net_profit: -50 }),
      t({ id: "R1", net_profit: 200 }),
    ];
    const { leaks, strengths } = detectLeaks(trades, null, analytics({}));
    expect(leaks.find((l) => l.type === "revenge_trading")).toBeFalsy();
    expect(strengths.find((s) => s.type === "revenge_trading")?.dollarImpact).toBe(200);
  });

  it("ranks leaks by dollar impact, most negative first", () => {
    const trades = [
      t({ id: "L1", net_profit: -50 }),
      t({ id: "L2", net_profit: -50 }),
      t({ id: "R1", net_profit: -500 }),
      t({ id: "off", symbol: "EURUSD", net_profit: -40 }),
    ];
    const { leaks } = detectLeaks(
      trades,
      { instruments: ["XAUUSD"] } as never,
      analytics({})
    );
    expect(leaks[0].dollarImpact).toBeLessThanOrEqual(leaks[1].dollarImpact);
  });
});
