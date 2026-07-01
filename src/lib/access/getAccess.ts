import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  accessTier,
  daysRemaining,
  type AccessTier,
  type AccountStatus,
} from "@/lib/trial/status";

// The single server-side access resolver. Every gated surface derives its
// view of the user from this — never from ad-hoc per-page checks.

export interface AccessProfile {
  id: string;
  email: string;
  full_name: string | null;
  account_status: AccountStatus;
  /** Null for members — cleared on the flip to member_active. */
  trial_ends_at: string | null;
  trial_count: number;
  downgraded_at: string | null;
  member_status: "active" | "inactive";
  is_admin: boolean;
  tradingview_username: string | null;
  /** Set when the user completes Know Your Style ("Send me a copy"). */
  kys_completed_at: string | null;
  kys_archetype: string | null;
}

export type Access =
  | { signedIn: false }
  | {
      signedIn: true;
      /** Null only if the profile row is missing/unreadable (fail closed). */
      profile: AccessProfile | null;
      tier: AccessTier;
      /** Days left on the trial clock, from the SAME instant as tier. */
      daysLeft: number;
    };

/**
 * Resolve the caller's access. Lazily expires a due trial first (the Day 3
 * resolver), then derives the tier through the time-check guard. A signed-in
 * user with no readable profile resolves to Limited — we fail closed.
 */
export async function getAccess(): Promise<Access> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { signedIn: false };
  }

  const { data: profile, error } = await supabase.rpc(
    "fn_resolve_trial_status"
  );

  if (error || !profile) {
    return { signedIn: true, profile: null, tier: "Limited", daysLeft: 0 };
  }

  // One instant for both derivations — tier and countdown can never disagree.
  const row = profile as AccessProfile;
  const now = new Date();
  return {
    signedIn: true,
    profile: row,
    tier: accessTier(row, now),
    daysLeft: daysRemaining(row.trial_ends_at, now),
  };
}
