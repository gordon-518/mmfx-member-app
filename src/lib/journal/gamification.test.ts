import { describe, expect, it } from "vitest";
import { computeGameState, type GameInput } from "./gamification";
import type { JournalTradeRow, JournalRulesConfig } from "./types";
import { computeAnalytics } from "./analytics";

let seq = 0;
function t(o: Partial<JournalTradeRow> & { net_profit: number; day: string }): JournalTradeRow {
  seq += 1;
  return {
    id: `t${seq}`, account_id: "a", position_id: `p${seq}`, symbol: "XAUUSD", direction: "buy",
    status: "closed", volume: 0.4, open_price: 1, close_price: 1,
    open_time: `${o.day}T10:00:00.000Z`, close_time: `${o.day}T12:00:00.000Z`,
    profit: o.net_profit, commission: 0, swap: 0, duration_sec: 1,
    note: null, tags: null, emotion: null, ...o,
  };
}

// NOW is a Monday; 07-27/28/29 are Mon/Tue/Wed of the same ISO week.
const NOW = "2026-07-27T13:00:00.000Z";
function input(trades: JournalTradeRow[], config: JournalRulesConfig, over: Partial<GameInput> = {}): GameInput {
  return {
    analytics: computeAnalytics(trades, []),
    rulesConfig: config,
    goals: null,
    trades,
    now: NOW,
    ...over,
  };
}

describe("computeGameState", () => {
  const maxDaily: JournalRulesConfig = { max_daily_loss: { enabled: true, value: 200 } };

  it("flags whether any rule is enabled", () => {
    expect(computeGameState(input([t({ day: "2026-07-27", net_profit: 50 })], {})).rulesSet).toBe(false);
    expect(computeGameState(input([t({ day: "2026-07-27", net_profit: 50 })], maxDaily)).rulesSet).toBe(true);
  });

  it("counts trading days and clean days in the current ISO week", () => {
    const trades = [
      t({ day: "2026-07-27", net_profit: 50 }),
      t({ day: "2026-07-28", net_profit: -300 }), // breach: daily loss < -200
      t({ day: "2026-07-29", net_profit: 50 }),
    ];
    const g = computeGameState(input(trades, maxDaily));
    expect(g.tradingDaysThisWeek).toBe(3);
    expect(g.cleanDaysThisWeek).toBe(2); // the breached day is not clean
  });

  it("no rules → no clean days even on green days", () => {
    const g = computeGameState(input([t({ day: "2026-07-27", net_profit: 50 })], {}));
    expect(g.rulesSet).toBe(false);
    expect(g.cleanDaysThisWeek).toBe(0);
    expect(g.tradingDaysThisWeek).toBe(1);
  });
});
