// The tier ladder (conversion-fix 3.3). Pure and client-safe: the server
// guards, the feature map and the nav all derive access from tierFor().
//
// Paid tiers gate on a member's CUMULATIVE verified deposits — a high-water
// mark, never current balance, so a drawdown can't strip access mid-trade
// (decision 5). Thresholds from the plan's tier table.

import { accessTier, type AccountStatus } from "@/lib/trial/status";

export type PaidTier = "foundation" | "desk" | "team";

/** Every tier a signed-in user can be on. A live trial is Desk-equivalent. */
export type MemberTier = "free" | "trial" | PaidTier;

export const TIER_THRESHOLDS: Readonly<Record<PaidTier, number>> = {
  foundation: 50,
  desk: 200,
  team: 500,
};

/** Ordering for access checks. A trial ranks with Desk (decision 7). */
export const TIER_RANK: Readonly<Record<MemberTier, number>> = {
  free: 0,
  foundation: 1,
  desk: 2,
  trial: 2,
  team: 3,
};

/** The paid tier a cumulative deposit total unlocks, or null below $50. */
export function paidTierFor(cumulativeUsd: number): PaidTier | null {
  if (!Number.isFinite(cumulativeUsd)) return null;
  if (cumulativeUsd >= TIER_THRESHOLDS.team) return "team";
  if (cumulativeUsd >= TIER_THRESHOLDS.desk) return "desk";
  if (cumulativeUsd >= TIER_THRESHOLDS.foundation) return "foundation";
  return null;
}

export interface TierSnapshot {
  account_status: AccountStatus;
  trial_ends_at: string | Date | null;
  /** Cumulative verified deposits (PostgREST may send numeric as a string). */
  deposit_amount: number | string | null;
  grandfathered: boolean | null;
}

/**
 * The viewer's tier.
 * - member_active + grandfathered            -> team (decision 6: never downgraded)
 * - member_active                            -> by cumulative deposits; a member an
 *   admin set by hand with no qualifying deposit gets Foundation, the lowest paid
 *   tier, rather than being locked out
 * - trial / re-trial inside its clock        -> trial (the time-check guard in
 *   accessTier, so a late expiry write can never extend access)
 * - everything else (expired, removed)       -> free
 */
export function tierFor(p: TierSnapshot, now: Date = new Date()): MemberTier {
  if (p.account_status === "member_active") {
    if (p.grandfathered) return "team";
    return paidTierFor(Number(p.deposit_amount ?? 0)) ?? "foundation";
  }
  return accessTier(p, now) === "Full" ? "trial" : "free";
}

const PAID_ORDER: readonly PaidTier[] = ["foundation", "desk", "team"];

/**
 * The next paid tier a cumulative total can reach, and the top-up that gets
 * there (conversion-fix 3.6: "top up $X to unlock Desk"). Null at Team MM.
 */
export function nextTierFor(cumulativeUsd: number): { next: PaidTier; topUp: number } | null {
  const have = Number.isFinite(cumulativeUsd) && cumulativeUsd > 0 ? cumulativeUsd : 0;
  const next = PAID_ORDER.find((t) => TIER_THRESHOLDS[t] > have);
  if (!next) return null;
  return { next, topUp: Math.round((TIER_THRESHOLDS[next] - have) * 100) / 100 };
}

const LABELS: Readonly<Record<MemberTier, string>> = {
  free: "Free",
  trial: "Trial",
  foundation: "Foundation",
  desk: "Desk",
  team: "Team MM",
};

export function tierLabel(t: MemberTier): string {
  return LABELS[t];
}

/** "Foundation · $50" — how a locked feature says what unlocks it. */
export function tierUnlockLabel(t: PaidTier): string {
  return `${LABELS[t]} · $${TIER_THRESHOLDS[t]}`;
}
