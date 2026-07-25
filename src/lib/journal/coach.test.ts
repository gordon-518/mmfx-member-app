import { describe, expect, it } from "vitest";
import { behavioralSignals, buildReportPrompt } from "./coach";
import { computeAnalytics } from "./analytics";
import type { JournalGoalsRow, JournalTradeRow } from "./types";

function trade(
  o: Partial<JournalTradeRow> & { net_profit: number; open_time: string }
): JournalTradeRow {
  return {
    id: Math.random().toString(36).slice(2),
    account_id: "a",
    position_id: "p" + Math.random().toString(36).slice(2),
    symbol: "XAUUSD",
    direction: "buy",
    status: "closed",
    volume: 1,
    open_price: 2400,
    close_price: 2410,
    close_time: o.open_time,
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

const D = (h: number) => `2026-07-01T${String(h).padStart(2, "0")}:00:00.000Z`;

describe("behavioralSignals", () => {
  const trades: JournalTradeRow[] = [
    trade({ net_profit: 10, volume: 1, open_time: D(10), emotion: "disciplined" }),
    trade({ net_profit: -10, volume: 1, open_time: D(11), emotion: "revenge" }),
    trade({ net_profit: 5, volume: 2, open_time: D(12) }), // after a loss → size up
    trade({ net_profit: 5, volume: 1, open_time: D(13) }), // after a win
  ];
  const goals = { instruments: ["XAUUSD"] } as JournalGoalsRow;

  it("counts emotions and the risky-emotion rate", () => {
    const s = behavioralSignals(trades, goals);
    expect(s.emotionCounts).toEqual({ disciplined: 1, revenge: 1 });
    expect(s.riskyEmotionRate).toBeCloseTo(0.5); // 1 revenge of 2 logged
  });

  it("detects revenge sizing (bigger size after a loss)", () => {
    const s = behavioralSignals(trades, goals);
    expect(s.avgSizeAfterLoss).toBeCloseTo(2);
    expect(s.avgSizeAfterWin).toBeCloseTo(1);
  });

  it("flags off-instrument trading against stated goals", () => {
    const withEur = [...trades, trade({ symbol: "EURUSD", net_profit: 1, open_time: D(14) })];
    const s = behavioralSignals(withEur, goals);
    expect(s.offInstrumentRate).toBeCloseTo(1 / 5);
  });

  it("counts the busiest trading day", () => {
    const s = behavioralSignals(trades, goals);
    expect(s.maxTradesInDay).toBe(4);
  });

  it("returns null rates when there is nothing to measure", () => {
    const s = behavioralSignals([], null);
    expect(s.riskyEmotionRate).toBeNull();
    expect(s.offInstrumentRate).toBeNull();
    expect(s.avgSizeAfterLoss).toBeNull();
  });
});

describe("buildReportPrompt", () => {
  it("includes the headline numbers, goals and behavioural signals", () => {
    const trades = [
      trade({ net_profit: 100, open_time: D(10) }),
      trade({ net_profit: -40, open_time: D(11), emotion: "revenge" }),
    ];
    const goals = {
      style: "day",
      monthly_target_pct: 8,
      max_drawdown_pct: 10,
      focus_text: "Stop revenge trading",
      instruments: ["XAUUSD"],
    } as JournalGoalsRow;
    const analytics = computeAnalytics(trades, []);
    const signals = behavioralSignals(trades, goals);
    const prompt = buildReportPrompt({ analytics, signals, goals, sampleTrades: trades });

    expect(prompt).toContain("Stop revenge trading"); // goal focus
    expect(prompt).toContain("8"); // monthly target
    expect(prompt).toMatch(/win rate/i);
    expect(prompt).toContain("revenge"); // emotion signal surfaced
    expect(prompt.length).toBeGreaterThan(200);
  });

  it("includes quantified leaks and health when present", () => {
    const prompt = buildReportPrompt({
      analytics: { ...computeAnalytics([], []), avgWin: 100, avgLoss: -100 },
      signals: behavioralSignals([], null),
      goals: null,
      sampleTrades: [],
      health: {
        status: "at_risk",
        runwaySentence: "~5 losing trades from your 10% drawdown limit",
        factors: ["Drawdown 5% of 10%"],
      } as never,
      leaks: {
        leaks: [
          {
            type: "revenge_trading",
            title: "Trading after losses",
            dollarImpact: -1240,
            tier: "actual",
            tradeCount: 18,
            tradeIds: [],
            detail: "18 trades after 2+ losses.",
          },
        ],
        strengths: [],
      } as never,
    });
    expect(prompt).toContain("~5 losing trades");
    expect(prompt).toContain("Trading after losses");
  });

  it("includes the discipline score and broken rules when present", () => {
    const prompt = buildReportPrompt({
      analytics: computeAnalytics([], []),
      signals: behavioralSignals([], null),
      goals: null,
      sampleTrades: [],
      rules: {
        score: 72,
        cleanDays: 18,
        tradingDays: 25,
        perRule: [],
        breaches: [
          {
            rule: "max_daily_loss",
            title: "Max daily loss",
            when: "2026-07-20",
            detail: "Lost $420 vs your $200 limit",
            tradeIds: [],
          },
        ],
      } as never,
    });
    expect(prompt).toContain("DISCIPLINE: 72% clean days");
    expect(prompt).toContain("Max daily loss");
  });
});
