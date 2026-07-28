import { describe, expect, it } from "vitest";
import { computeGameState, levelForXp, xpToReachLevel, type GameInput } from "./gamification";
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

describe("levelForXp / xpToReachLevel", () => {
  it("uses a rising curve, level 1 at 0 XP", () => {
    expect(xpToReachLevel(1)).toBe(0);
    expect(xpToReachLevel(2)).toBe(100);
    expect(xpToReachLevel(5)).toBe(1000);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(1240)).toBe(5); // 1000 ≤ 1240 < 1500
    expect(levelForXp(99)).toBe(1);
  });
});

describe("computeGameState", () => {
  const maxDaily: JournalRulesConfig = { max_daily_loss: { enabled: true, value: 200 } };

  it("streak counts consecutive clean trading days from the latest, resets on a breach", () => {
    const trades = [
      t({ day: "2026-07-20", net_profit: 50 }),
      t({ day: "2026-07-21", net_profit: 50 }),
      t({ day: "2026-07-22", net_profit: 50 }),
      t({ day: "2026-07-23", net_profit: -300 }), // breach: < -200
    ];
    const g = computeGameState(input(trades, maxDaily));
    expect(g.streak).toBe(0); // latest day breached
    expect(g.longestStreak).toBe(3);
  });

  it("counts a clean current streak", () => {
    const trades = [
      t({ day: "2026-07-20", net_profit: -300 }), // breach
      t({ day: "2026-07-21", net_profit: 50 }),
      t({ day: "2026-07-22", net_profit: 50 }),
    ];
    const g = computeGameState(input(trades, maxDaily));
    expect(g.streak).toBe(2);
    expect(g.longestStreak).toBe(2);
  });

  it("no rules → streak 0 and rulesSet false", () => {
    const trades = [t({ day: "2026-07-22", net_profit: 50 })];
    const g = computeGameState(input(trades, {}));
    expect(g.rulesSet).toBe(false);
    expect(g.streak).toBe(0);
  });

  it("awards XP for journaled trades, clean days and streak milestones", () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      t({ day: `2026-07-2${i + 1}`, net_profit: 50, note: i === 0 ? "logged" : null })
    );
    const g = computeGameState(input(days, maxDaily));
    // 7 clean days ×10 = 70, 1 journaled ×5 = 5, 7-day milestone +50 = 125
    expect(g.xp).toBe(125);
    expect(g.longestStreak).toBe(7);
    expect(g.level).toBe(levelForXp(125));
  });
});
