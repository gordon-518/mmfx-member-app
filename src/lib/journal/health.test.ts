import { describe, expect, it } from "vitest";
import { accountHealth } from "./health";
import type { JournalAnalytics } from "./analytics";

function analytics(over: Partial<JournalAnalytics>): JournalAnalytics {
  return {
    startingBalance: 1000,
    avgLoss: -50,
    equityCurve: [],
    ...over,
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

  it("no balance basis → no fabricated drawdown % (credit/demo inflation bug)", () => {
    const a = analytics({
      startingBalance: null,
      endingBalance: null,
      equityCurve: [
        { time: "t1", value: 1000 }, // +1000 profit peak
        { time: "t2", value: 100 }, // dropped to +100
      ],
      avgLoss: -50,
    });
    const h = accountHealth([], a, { max_drawdown_pct: 10 } as never, 0);
    expect(h.hasEquityBasis).toBe(false);
    expect(h.currentDrawdownPct).toBe(0); // old bug measured 900/1000 = 90%
    expect(h.status).toBe("healthy");
    expect(h.runwayTrades).toBeNull();
  });

  it("with a balance basis, a small dip is a small drawdown %", () => {
    const a = analytics({
      startingBalance: 250000,
      equityCurve: [
        { time: "t1", value: 18000 },
        { time: "t2", value: 12000 },
      ],
      avgLoss: -500,
    });
    const h = accountHealth([], a, { max_drawdown_pct: 10 } as never, 0);
    expect(h.hasEquityBasis).toBe(true);
    expect(h.currentDrawdownPct).toBeLessThan(3); // 6000 / 268000 ≈ 2.2%
    expect(h.status).toBe("healthy");
  });
});
