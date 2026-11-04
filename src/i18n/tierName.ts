import { TIER_THRESHOLDS, type MemberTier, type PaidTier } from "@/lib/tiers";
import type { Messages } from "./messages/types";
import { fmt } from "./format";

/** The tier as the reader sees it. Brand tier names are the same in every language. */
export function tierName(t: Messages, tier: MemberTier): string {
  return t.tiers[tier];
}

/** "Unlocks at Desk · $200", in the reader's language. */
export function unlocksAt(t: Messages, tier: PaidTier): string {
  return fmt(t.nav.unlocksAt, { tier: `${t.tiers[tier]} · $${TIER_THRESHOLDS[tier]}` });
}
