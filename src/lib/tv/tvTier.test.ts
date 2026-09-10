import { describe, it, expect } from "vitest";
import { TV_ENTITLED_STATUSES } from "./resolveTvAccounts";
import { tierFor } from "@/lib/tiers";
import { canAccess } from "@/lib/access/features";
import type { AccountStatus } from "@/lib/trial/status";

// conversion-fix 3.4 — the TradingView grant automation decides by account
// status (cheap, and it runs over every profile nightly), while pages decide by
// the tier ladder. They must agree: indicators and strategies open at
// Foundation, trials are Desk-equivalent, Free loses access. This pins it, so a
// tier change that makes some member_active user less than Foundation (or a
// new status) fails here instead of silently granting or revoking on TradingView.

const ALL: AccountStatus[] = [
  "trial_active",
  "trial_expired",
  "member_active",
  "re_trial_active",
  "re_trial_expired",
  "member_expired",
];
const FUTURE = "2999-01-01T00:00:00Z";

describe("TradingView entitlement matches the tier ladder", () => {
  it.each(ALL)("%s", (status) => {
    // The weakest profile in each status: no deposit, not grandfathered, and
    // (for trials) inside the clock, which is when TV is granted with an expiry.
    const tier = tierFor({ account_status: status, trial_ends_at: FUTURE, deposit_amount: null, grandfathered: false });
    const byTier =
      canAccess("indicators", { tier, isAdmin: false }) && canAccess("strategies", { tier, isAdmin: false });
    expect(TV_ENTITLED_STATUSES.has(status)).toBe(byTier);
  });
});
