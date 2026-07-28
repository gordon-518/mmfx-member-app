import { describe, it, expect } from "vitest";
import { lintPost } from "@/lib/channel/compliance";

describe("lintPost", () => {
  it("passes clean educational copy", () => {
    expect(lintPost("Structure over feelings. Process over profit.").ok).toBe(true);
  });
  it("rejects guaranteed-return claims", () => {
    expect(lintPost("guaranteed profit every week").ok).toBe(false);
  });
  it("rejects the IB number and per-lot payouts", () => {
    expect(lintPost("IB 47807426").ok).toBe(false);
    expect(lintPost("we earn $20/lot").ok).toBe(false);
    expect(lintPost("broker rebate on volume").ok).toBe(false);
  });
  it("returns the offending hits", () => {
    const r = lintPost("guaranteed and no-loss");
    expect(r.ok).toBe(false);
    expect(r.hits.length).toBeGreaterThanOrEqual(2);
  });
});
