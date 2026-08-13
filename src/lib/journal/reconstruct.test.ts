import { describe, expect, it } from "vitest";
import { reconstructTrades } from "./reconstruct";
import type { MetaApiDeal } from "./types";

// Helper: minimal deal with overridable fields.
function deal(overrides: Partial<MetaApiDeal> & { id: string }): MetaApiDeal {
  return {
    type: "DEAL_TYPE_BUY",
    time: "2026-07-01T10:00:00.000Z",
    profit: 0,
    commission: 0,
    swap: 0,
    ...overrides,
  };
}

describe("reconstructTrades", () => {
  it("reconstructs a simple closed buy round-trip", () => {
    const deals: MetaApiDeal[] = [
      deal({
        id: "1",
        positionId: "P1",
        symbol: "XAUUSD",
        type: "DEAL_TYPE_BUY",
        entryType: "DEAL_ENTRY_IN",
        volume: 1,
        price: 2400,
        commission: -7,
        time: "2026-07-01T10:00:00.000Z",
      }),
      deal({
        id: "2",
        positionId: "P1",
        symbol: "XAUUSD",
        type: "DEAL_TYPE_SELL",
        entryType: "DEAL_ENTRY_OUT",
        volume: 1,
        price: 2410,
        profit: 1000,
        swap: -2,
        time: "2026-07-01T12:00:00.000Z",
      }),
    ];

    const { trades, cashFlows } = reconstructTrades(deals);
    expect(cashFlows).toEqual([]);
    expect(trades).toHaveLength(1);
    const t = trades[0];
    expect(t.positionId).toBe("P1");
    expect(t.symbol).toBe("XAUUSD");
    expect(t.direction).toBe("buy");
    expect(t.status).toBe("closed");
    expect(t.volume).toBe(1);
    expect(t.openPrice).toBe(2400);
    expect(t.closePrice).toBe(2410);
    expect(t.openTime).toBe("2026-07-01T10:00:00.000Z");
    expect(t.closeTime).toBe("2026-07-01T12:00:00.000Z");
    expect(t.profit).toBe(1000);
    expect(t.commission).toBe(-7);
    expect(t.swap).toBe(-2);
    expect(t.netProfit).toBe(991);
    expect(t.durationSec).toBe(7200);
  });

  it("reconstructs a sell trade with direction from the entry deal type", () => {
    const deals: MetaApiDeal[] = [
      deal({
        id: "1",
        positionId: "P2",
        symbol: "EURUSD",
        type: "DEAL_TYPE_SELL",
        entryType: "DEAL_ENTRY_IN",
        volume: 0.5,
        price: 1.09,
      }),
      deal({
        id: "2",
        positionId: "P2",
        symbol: "EURUSD",
        type: "DEAL_TYPE_BUY",
        entryType: "DEAL_ENTRY_OUT",
        volume: 0.5,
        price: 1.08,
        profit: 500,
        time: "2026-07-01T11:00:00.000Z",
      }),
    ];

    const t = reconstructTrades(deals).trades[0];
    expect(t.direction).toBe("sell");
    expect(t.status).toBe("closed");
    expect(t.netProfit).toBe(500);
  });

  it("keeps a partially-closed position open with realized profit so far", () => {
    const deals: MetaApiDeal[] = [
      deal({
        id: "1",
        positionId: "P3",
        symbol: "XAUUSD",
        entryType: "DEAL_ENTRY_IN",
        volume: 2,
        price: 2400,
      }),
      deal({
        id: "2",
        positionId: "P3",
        symbol: "XAUUSD",
        type: "DEAL_TYPE_SELL",
        entryType: "DEAL_ENTRY_OUT",
        volume: 1,
        price: 2410,
        profit: 1000,
        time: "2026-07-01T11:00:00.000Z",
      }),
    ];

    const t = reconstructTrades(deals).trades[0];
    expect(t.status).toBe("open");
    expect(t.volume).toBe(2);
    expect(t.profit).toBe(1000);
    expect(t.closePrice).toBeNull();
    expect(t.closeTime).toBeNull();
    expect(t.durationSec).toBeNull();
  });

  it("volume-weights entry and exit prices across multiple legs", () => {
    const deals: MetaApiDeal[] = [
      deal({
        id: "1",
        positionId: "P4",
        symbol: "XAUUSD",
        entryType: "DEAL_ENTRY_IN",
        volume: 1,
        price: 2400,
      }),
      deal({
        id: "2",
        positionId: "P4",
        symbol: "XAUUSD",
        entryType: "DEAL_ENTRY_IN",
        volume: 1,
        price: 2410,
        time: "2026-07-01T10:30:00.000Z",
      }),
      deal({
        id: "3",
        positionId: "P4",
        symbol: "XAUUSD",
        type: "DEAL_TYPE_SELL",
        entryType: "DEAL_ENTRY_OUT",
        volume: 1.5,
        price: 2420,
        profit: 2000,
        time: "2026-07-01T11:00:00.000Z",
      }),
      deal({
        id: "4",
        positionId: "P4",
        symbol: "XAUUSD",
        type: "DEAL_TYPE_SELL",
        entryType: "DEAL_ENTRY_OUT",
        volume: 0.5,
        price: 2430,
        profit: 800,
        time: "2026-07-01T11:30:00.000Z",
      }),
    ];

    const t = reconstructTrades(deals).trades[0];
    expect(t.status).toBe("closed");
    expect(t.openPrice).toBe(2405); // (2400*1 + 2410*1) / 2
    expect(t.closePrice).toBe(2422.5); // (2420*1.5 + 2430*0.5) / 2
    expect(t.profit).toBe(2800);
    expect(t.closeTime).toBe("2026-07-01T11:30:00.000Z");
  });

  it("treats DEAL_ENTRY_INOUT as closing the position", () => {
    const deals: MetaApiDeal[] = [
      deal({
        id: "1",
        positionId: "P5",
        symbol: "EURUSD",
        entryType: "DEAL_ENTRY_IN",
        volume: 1,
        price: 1.09,
      }),
      deal({
        id: "2",
        positionId: "P5",
        symbol: "EURUSD",
        type: "DEAL_TYPE_SELL",
        entryType: "DEAL_ENTRY_INOUT",
        volume: 2,
        price: 1.1,
        profit: 1000,
        time: "2026-07-01T11:00:00.000Z",
      }),
    ];

    const t = reconstructTrades(deals).trades[0];
    expect(t.status).toBe("closed");
    expect(t.direction).toBe("buy");
    expect(t.profit).toBe(1000);
  });

  it("is deterministic on out-of-order input", () => {
    const inOrder: MetaApiDeal[] = [
      deal({
        id: "1",
        positionId: "P6",
        symbol: "XAUUSD",
        entryType: "DEAL_ENTRY_IN",
        volume: 1,
        price: 2400,
        time: "2026-07-01T10:00:00.000Z",
      }),
      deal({
        id: "2",
        positionId: "P6",
        symbol: "XAUUSD",
        type: "DEAL_TYPE_SELL",
        entryType: "DEAL_ENTRY_OUT",
        volume: 1,
        price: 2410,
        profit: 1000,
        time: "2026-07-01T12:00:00.000Z",
      }),
    ];
    const shuffled = [inOrder[1], inOrder[0]];

    expect(reconstructTrades(shuffled)).toEqual(reconstructTrades(inOrder));
    expect(reconstructTrades(shuffled).trades[0].direction).toBe("buy");
  });

  it("extracts balance deals as cash flows, not trades", () => {
    const deals: MetaApiDeal[] = [
      deal({
        id: "10",
        type: "DEAL_TYPE_BALANCE",
        profit: 5000,
        comment: "Deposit",
        time: "2026-06-30T09:00:00.000Z",
      }),
      deal({
        id: "11",
        type: "DEAL_TYPE_BALANCE",
        profit: -1000,
        comment: "Withdrawal",
        time: "2026-07-02T09:00:00.000Z",
      }),
    ];

    const { trades, cashFlows } = reconstructTrades(deals);
    expect(trades).toEqual([]);
    expect(cashFlows).toEqual([
      {
        dealId: "10",
        amount: 5000,
        time: "2026-06-30T09:00:00.000Z",
        comment: "Deposit",
      },
      {
        dealId: "11",
        amount: -1000,
        time: "2026-07-02T09:00:00.000Z",
        comment: "Withdrawal",
      },
    ]);
  });

  it("closes a trade whose entry fell outside the fetched history", () => {
    // Only the exit leg is visible: direction inferred as opposite of the
    // exit deal type; openPrice unknown.
    const deals: MetaApiDeal[] = [
      deal({
        id: "1",
        positionId: "P7",
        symbol: "XAUUSD",
        type: "DEAL_TYPE_SELL",
        entryType: "DEAL_ENTRY_OUT",
        volume: 1,
        price: 2410,
        profit: 750,
        time: "2026-07-01T12:00:00.000Z",
      }),
    ];

    const t = reconstructTrades(deals).trades[0];
    expect(t.direction).toBe("buy");
    expect(t.status).toBe("closed");
    expect(t.openPrice).toBeNull();
    expect(t.netProfit).toBe(750);
  });

  it("ignores non-trade, non-balance deal types and deals without a position", () => {
    const deals: MetaApiDeal[] = [
      deal({ id: "1", type: "DEAL_TYPE_CREDIT", profit: 100 }),
      deal({ id: "2", type: "DEAL_TYPE_BUY", entryType: "DEAL_ENTRY_IN" }), // no positionId
    ];

    const { trades, cashFlows } = reconstructTrades(deals);
    expect(trades).toEqual([]);
    expect(cashFlows).toEqual([]);
  });
});

describe("reconstructTrades — dedup by deal id", () => {
  it("is idempotent: repeated deal ids don't double-count P&L or volume", () => {
    const deals: MetaApiDeal[] = [
      deal({ id: "1", positionId: "P1", type: "DEAL_TYPE_BUY", entryType: "DEAL_ENTRY_IN", volume: 1, price: 2400, time: "2026-07-01T10:00:00.000Z" }),
      deal({ id: "2", positionId: "P1", type: "DEAL_TYPE_SELL", entryType: "DEAL_ENTRY_OUT", volume: 1, price: 2410, profit: 100, commission: -7, swap: -2, time: "2026-07-01T12:00:00.000Z" }),
    ];
    const once = reconstructTrades(deals).trades[0];
    const dupd = reconstructTrades([...deals, ...deals]).trades[0]; // every deal twice
    expect(dupd.netProfit).toBe(once.netProfit);
    expect(dupd.volume).toBe(once.volume);
    expect(dupd.profit).toBe(once.profit);
  });
});
