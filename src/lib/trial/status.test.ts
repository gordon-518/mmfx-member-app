import { describe, it, expect } from "vitest";
import {
  accessTier,
  daysRemaining,
  resolveTrialView,
  type TrialSnapshot,
} from "./status";

// Reference instant for trial_ends_at across the suite.
const END = new Date("2026-06-09T12:00:00.000Z");
const endIso = END.toISOString();

const at = (msFromEnd: number) => new Date(END.getTime() + msFromEnd);
const DAY = 86_400_000;

describe("accessTier — time-check guard", () => {
  it("trial_active exactly at expiry (now == trial_ends_at) → Limited", () => {
    const snap: TrialSnapshot = {
      account_status: "trial_active",
      trial_ends_at: endIso,
    };
    expect(accessTier(snap, END)).toBe("Limited");
  });

  it("trial_active one second before expiry → Full", () => {
    const snap: TrialSnapshot = {
      account_status: "trial_active",
      trial_ends_at: endIso,
    };
    expect(accessTier(snap, at(-1000))).toBe("Full");
  });

  it("re_trial_active follows the same guard (Full just before, Limited at expiry)", () => {
    const snap: TrialSnapshot = {
      account_status: "re_trial_active",
      trial_ends_at: endIso,
    };
    expect(accessTier(snap, at(-1000))).toBe("Full");
    expect(accessTier(snap, END)).toBe("Limited");
  });

  it("member_active is always Full, regardless of the clock", () => {
    const snap: TrialSnapshot = {
      account_status: "member_active",
      trial_ends_at: endIso,
    };
    expect(accessTier(snap, at(-1000))).toBe("Full"); // before clock
    expect(accessTier(snap, END)).toBe("Full"); // at clock
    expect(accessTier(snap, at(365 * DAY))).toBe("Full"); // long past clock
  });

  it("trial_expired and re_trial_expired are Limited (even before the clock)", () => {
    expect(
      accessTier(
        { account_status: "trial_expired", trial_ends_at: endIso },
        at(-1000)
      )
    ).toBe("Limited");
    expect(
      accessTier(
        { account_status: "re_trial_expired", trial_ends_at: endIso },
        at(-1000)
      )
    ).toBe("Limited");
  });
});

describe("daysRemaining", () => {
  it("is 0 exactly at expiry", () => {
    expect(daysRemaining(endIso, END)).toBe(0);
  });

  it("is 1 one second before expiry", () => {
    expect(daysRemaining(endIso, at(-1000))).toBe(1);
  });

  it("clamps at 0 for a past date (now after trial_ends_at)", () => {
    expect(daysRemaining(endIso, at(10 * DAY))).toBe(0);
  });

  it("rounds partial days up (≈14 just after a 14-day trial starts)", () => {
    // now = end - 14 days + 5s  →  13.99994 days remaining  →  ceil 14
    expect(daysRemaining(endIso, at(-14 * DAY + 5000))).toBe(14);
  });
});

describe("resolveTrialView", () => {
  it("composes status label, days remaining, and tier together", () => {
    const snap: TrialSnapshot = {
      account_status: "trial_active",
      trial_ends_at: endIso,
    };
    expect(resolveTrialView(snap, at(-3 * DAY))).toEqual({
      accountStatus: "trial_active",
      statusLabel: "Trial active",
      daysRemaining: 3,
      accessTier: "Full",
    });
  });
});
