import { describe, it, expect } from "vitest";
import { paidTierFor, TIER_THRESHOLDS } from "./tiers";

describe("paidTierFor — every threshold edge from the plan", () => {
  it.each([
    [0, null],
    [49.99, null],
    [50, "foundation"],
    [199.99, "foundation"],
    [200, "desk"],
    [499.99, "desk"],
    [500, "team"],
    [25_000, "team"],
  ] as const)("$%s -> %s", (amount, tier) => {
    expect(paidTierFor(amount)).toBe(tier);
  });

  it("returns null for non-finite and negative totals", () => {
    expect(paidTierFor(Number.NaN)).toBeNull();
    expect(paidTierFor(Number.POSITIVE_INFINITY)).toBeNull();
    expect(paidTierFor(-100)).toBeNull();
  });

  it("matches the plan's tier table", () => {
    expect(TIER_THRESHOLDS).toEqual({ foundation: 50, desk: 200, team: 500 });
  });
});
