import { describe, it, expect } from "vitest";
import { planPermanentGrant } from "./grantPlan";

describe("planPermanentGrant", () => {
  it("adds when the user is not granted", () => {
    expect(planPermanentGrant({ granted: false, expiration: null })).toBe("add");
  });

  it("skips when already granted permanently (no expiration)", () => {
    expect(planPermanentGrant({ granted: true, expiration: null })).toBe("skip");
    expect(planPermanentGrant({ granted: true, expiration: "" })).toBe("skip");
  });

  it("resets when granted but still carrying a trial expiration", () => {
    expect(planPermanentGrant({ granted: true, expiration: "2026-08-13" })).toBe("reset");
  });

  it("falls back to a plain add (never removes) when the lookup failed", () => {
    // null = we could not read the grant state — must NOT remove on uncertainty.
    expect(planPermanentGrant(null)).toBe("add");
  });
});
