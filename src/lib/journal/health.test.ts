import { describe, expect, it } from "vitest";
import { accountHealth } from "./health";
import type { JournalAnalytics } from "./analytics";

function analytics(over: Partial<JournalAnalytics>): JournalAnalytics {
  return {
    startingBalance: 1000,
    avgLoss: -50,
    equityCurve: [],
    ...(over as JournalAnalytics),
  } as JournalAnalytics;
}

describe("accountHealth", () => {
  it("computes current drawdown from peak equity and sets status", () => {
    const a = analytics({
      startingBalance: 1000,
      equityCurve: [
        { time: "t1", value: 200 },
        { time: "t2", value: 80 },
      ],
      avgLoss: -60,
    });
    const h = accountHealth([], a, { max_drawdown_pct: 10 } as never, 0);
    expect(h.currentDrawdownPct).toBe(10);
    expect(h.maxDrawdownTolerancePct).toBe(10);
    expect(h.status).toBe("critical");
  });

  it("survival runway = remaining room / avg loss", () => {
    const a = analytics({
      startingBalance: 1000,
      equityCurve: [
        { time: "t1", value: 200 },
        { time: "t2", value: 140 },
      ],
      avgLoss: -60,
    });
    const h = accountHealth([], a, { max_drawdown_pct: 10 } as never, 0);
    expect(h.runwayTrades).toBe(1);
    expect(h.status).toBe("at_risk");
  });

  it("falls back to a default tolerance and flags it", () => {
    const a = analytics({
      startingBalance: 1000,
      equityCurve: [{ time: "t1", value: 0 }],
    });
    const h = accountHealth([], a, null, 0);
    expect(h.maxDrawdownTolerancePct).toBe(15);
    expect(h.usedDefaultTolerance).toBe(true);
    expect(h.status).toBe("healthy");
  });

  it("null runway when there is no average loss", () => {
    const a = analytics({ startingBalance: 1000, equityCurve: [], avgLoss: null });
    const h = accountHealth([], a, { max_drawdown_pct: 10 } as never, 0);
    expect(h.runwayTrades).toBeNull();
  });
});
