// Paid tiers, gated on a member's CUMULATIVE verified deposits — a high-water
// mark, never current balance, so a drawdown can't strip access mid-trade
// (conversion-fix decision 5). Thresholds from the plan's tier table.
//
// Phase 1 uses this to tag deposit_verified events. Task 3.3 builds
// tierFor(profile, now) on top of it (grandfathered, trial and free states).

export type PaidTier = "foundation" | "desk" | "team";

export const TIER_THRESHOLDS: Readonly<Record<PaidTier, number>> = {
  foundation: 50,
  desk: 200,
  team: 500,
};

/** The paid tier a cumulative deposit total unlocks, or null below $50. */
export function paidTierFor(cumulativeUsd: number): PaidTier | null {
  if (!Number.isFinite(cumulativeUsd)) return null;
  if (cumulativeUsd >= TIER_THRESHOLDS.team) return "team";
  if (cumulativeUsd >= TIER_THRESHOLDS.desk) return "desk";
  if (cumulativeUsd >= TIER_THRESHOLDS.foundation) return "foundation";
  return null;
}
