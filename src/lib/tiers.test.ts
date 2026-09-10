import { describe, it, expect } from "vitest";
import {
  paidTierFor,
  tierFor,
  tierLabel,
  tierUnlockLabel,
  TIER_THRESHOLDS,
  TIER_RANK,
  type TierSnapshot,
} from "./tiers";

const NOW = new Date("2026-09-10T12:00:00Z");
const LATER = "2026-09-20T12:00:00Z";
const EARLIER = "2026-09-01T12:00:00Z";

const member = (amount: number | string | null, grandfathered = false): TierSnapshot => ({
  account_status: "member_active",
  trial_ends_at: null,
  deposit_amount: amount,
  grandfathered,
});

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

describe("tierFor", () => {
  it.each([
    [50, "foundation"],
    [199.99, "foundation"],
    [200, "desk"],
    [499.99, "desk"],
    [500, "team"],
    [7810, "team"],
  ] as const)("a member with $%s cumulative -> %s", (amount, tier) => {
    expect(tierFor(member(amount), NOW)).toBe(tier);
  });

  it("reads a numeric string from PostgREST", () => {
    expect(tierFor(member("250.00"), NOW)).toBe("desk");
  });

  it("a grandfathered member is Team MM with no deposit on record (never downgraded)", () => {
    expect(tierFor(member(null, true), NOW)).toBe("team");
    expect(tierFor(member(60, true), NOW)).toBe("team");
  });

  it("a member set by hand with no qualifying deposit gets Foundation, not locked out", () => {
    expect(tierFor(member(null), NOW)).toBe("foundation");
    expect(tierFor(member(49.99), NOW)).toBe("foundation");
  });

  it("a trial inside its clock is trial; past it, free", () => {
    const trial = { account_status: "trial_active", deposit_amount: null, grandfathered: false } as const;
    expect(tierFor({ ...trial, trial_ends_at: LATER }, NOW)).toBe("trial");
    expect(tierFor({ ...trial, trial_ends_at: EARLIER }, NOW)).toBe("free");
    expect(tierFor({ ...trial, account_status: "re_trial_active", trial_ends_at: LATER }, NOW)).toBe("trial");
  });

  it("expired and removed accounts are free, grandfathered or not", () => {
    for (const s of ["trial_expired", "re_trial_expired", "member_expired"] as const) {
      expect(tierFor({ account_status: s, trial_ends_at: EARLIER, deposit_amount: 600, grandfathered: true }, NOW)).toBe("free");
    }
  });
});

describe("rank and labels", () => {
  it("a trial ranks with Desk (decision 7)", () => {
    expect(TIER_RANK.trial).toBe(TIER_RANK.desk);
    expect(TIER_RANK.free).toBeLessThan(TIER_RANK.foundation);
    expect(TIER_RANK.desk).toBeLessThan(TIER_RANK.team);
  });
  it("names tiers and their unlock thresholds", () => {
    expect(tierLabel("team")).toBe("Team MM");
    expect(tierUnlockLabel("desk")).toBe("Desk · $200");
  });
});
