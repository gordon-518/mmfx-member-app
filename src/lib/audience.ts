import type { AccountStatus } from "@/lib/trial/status";

// The email-segmentation bucket each member falls into. Mirrors the access
// model but collapsed to the four groups marketing cares about.
export type Audience = "member" | "trial" | "expired" | "removed";

/**
 * Effective audience bucket for a profile. Trial states are time-checked: a
 * trial whose clock has already passed is "expired" even if the DB row hasn't
 * been flipped yet (lazy expiry) — so segments reflect reality, not stale rows.
 */
export function audienceFor(
  status: AccountStatus,
  trialEndsAt: string | null,
  now: number
): Audience {
  switch (status) {
    case "member_active":
      return "member";
    case "member_expired":
      return "removed";
    case "trial_active":
    case "re_trial_active":
      if (trialEndsAt && new Date(trialEndsAt).getTime() <= now) return "expired";
      return "trial";
    case "trial_expired":
    case "re_trial_expired":
      return "expired";
    default:
      return "expired";
  }
}
