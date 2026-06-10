import { describe, it, expect } from "vitest";
import { canGrantRetrial, type RetrialSnapshot } from "./admin";

const NOW = new Date("2026-06-10T12:00:00.000Z");
const DAY = 86_400_000;

const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY).toISOString();

const base: RetrialSnapshot = {
  account_status: "trial_expired",
  downgraded_at: daysAgo(61),
  trial_count: 1,
};

describe("canGrantRetrial", () => {
  it("eligible: trial_expired, dormant 61 days, trial_count 1", () => {
    expect(canGrantRetrial(base, NOW)).toBe(true);
  });

  it("exactly 60 days dormant is eligible (>= boundary, matching the SQL)", () => {
    expect(
      canGrantRetrial({ ...base, downgraded_at: daysAgo(60) }, NOW)
    ).toBe(true);
  });

  it("under 60 days dormant is not eligible", () => {
    expect(
      canGrantRetrial({ ...base, downgraded_at: daysAgo(59) }, NOW)
    ).toBe(false);
    // one millisecond short of the boundary
    const justShort = new Date(NOW.getTime() - 60 * DAY + 1).toISOString();
    expect(canGrantRetrial({ ...base, downgraded_at: justShort }, NOW)).toBe(
      false
    );
  });

  it("trial_count already 2 is not eligible", () => {
    expect(canGrantRetrial({ ...base, trial_count: 2 }, NOW)).toBe(false);
  });

  it("wrong state is not eligible (only trial_expired qualifies)", () => {
    for (const account_status of [
      "trial_active",
      "member_active",
      "re_trial_active",
      "re_trial_expired",
    ] as const) {
      expect(canGrantRetrial({ ...base, account_status }, NOW)).toBe(false);
    }
  });

  it("missing downgraded_at is not eligible", () => {
    expect(canGrantRetrial({ ...base, downgraded_at: null }, NOW)).toBe(false);
  });
});
