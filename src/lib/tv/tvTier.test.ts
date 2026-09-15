import { describe, it, expect } from "vitest";
import { tvEntitlement, type TvProfileRow } from "./resolveTvAccounts";
import { accessTierFor } from "@/lib/tiers";
import { canAccess } from "@/lib/access/features";

// conversion-fix 3.4, revised 15 Sep (indicators + strategies moved to Desk):
// the TradingView grant automation must agree with the page gates for every
// kind of profile, so a tier change can't silently mis-grant or revoke on
// TradingView (where a revoke also deletes the member's alerts).

const NOW = new Date("2026-09-15T00:00:00Z");
const LATER = "2026-09-25T00:00:00Z";
const EARLIER = "2026-09-01T00:00:00Z";

const base = (o: Partial<TvProfileRow>): TvProfileRow => ({
  tradingview_username: "x",
  account_status: "member_active",
  trial_ends_at: null,
  deposit_amount: null,
  grandfathered: false,
  lifetime_plan: null,
  ...o,
});

const CASES: [string, TvProfileRow][] = [
  ["trial, clock running", base({ account_status: "trial_active", trial_ends_at: LATER })],
  ["trial, clock passed", base({ account_status: "trial_active", trial_ends_at: EARLIER })],
  ["expired trial", base({ account_status: "trial_expired", trial_ends_at: EARLIER })],
  ["Foundation member ($60)", base({ deposit_amount: 60 })],
  ["early depositor ($60, trial running)", base({ deposit_amount: 60, trial_ends_at: LATER })],
  ["Desk member ($250)", base({ deposit_amount: 250 })],
  ["Team member ($600)", base({ deposit_amount: 600 })],
  ["grandfathered", base({ grandfathered: true })],
  ["lifetime Team MM", base({ lifetime_plan: "team" })],
  ["removed member", base({ account_status: "member_expired", deposit_amount: 600 })],
];

describe("TradingView entitlement matches the tier ladder", () => {
  it.each(CASES)("%s", (_label, row) => {
    const tier = accessTierFor(
      { ...row, deposit_amount: row.deposit_amount ?? null, grandfathered: row.grandfathered ?? false },
      NOW
    );
    const pages = canAccess("indicators", { tier, isAdmin: false }) && canAccess("strategies", { tier, isAdmin: false });
    expect(tvEntitlement(row, NOW).grant).toBe(pages);
  });

  it("only a trial-backed grant carries an expiry", () => {
    expect(tvEntitlement(base({ deposit_amount: 250 }), NOW).expiresAt).toBeNull();
    expect(tvEntitlement(base({ deposit_amount: 60, trial_ends_at: LATER }), NOW).expiresAt).toBe(LATER);
  });
});
