import { describe, it, expect } from "vitest";
import { profitFactorLabel } from "./format";

describe("profitFactorLabel", () => {
  it("shows the number when there are losses", () => {
    expect(profitFactorLabel({ profitFactor: 1.84, grossWin: 5000 })).toBe("1.84");
  });
  it("shows ∞ for a flawless run (wins, no losses)", () => {
    expect(profitFactorLabel({ profitFactor: null, grossWin: 5000 })).toBe("∞");
  });
  it("shows — when there are no trades at all", () => {
    expect(profitFactorLabel({ profitFactor: null, grossWin: 0 })).toBe("—");
  });
});
