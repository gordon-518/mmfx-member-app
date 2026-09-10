import "server-only";

import { redirect } from "next/navigation";
import { getAccess, type AccessProfile } from "./getAccess";
import { logEventAfter } from "@/lib/events";
import { canAccess, type Viewer } from "./features";
import type { FeatureKey } from "./featureKeys";
import type { AccessTier } from "@/lib/trial/status";

export interface FeatureGate {
  profile: AccessProfile;
  tier: AccessTier;
  viewer: Viewer;
  /** True when the viewer can't use this feature: render <LockedFeature>. */
  locked: boolean;
}

/**
 * The guard for every feature page and download route (conversion-fix 2.2).
 * It replaces requireFull(), which bounced every Free user to /upgrade.
 *
 *   const gate = await requireFeature("signals");
 *   if (gate.locked) return <LockedFeature feature="signals" gate={gate} />;
 *
 * - Signed out -> /login.
 * - No readable profile -> /dashboard, which renders its "setting up" state
 *   (fail closed; nothing gated is returned).
 * - A funded member with no trading account number on file -> /dashboard,
 *   which renders that gate (the rule requireFull had).
 * - Locked -> returned with locked: true so the page renders a preview, or,
 *   with onLocked: "redirect" (download routes, which have no page), -> /upgrade.
 *
 * A granted page view logs feature_view (conversion-fix 1.3), after the
 * response and deduped in the database. Download routes pass log: false.
 */
export async function requireFeature(
  feature: FeatureKey,
  opts: { onLocked?: "preview" | "redirect"; log?: boolean } = {}
): Promise<FeatureGate> {
  const { onLocked = "preview", log = true } = opts;
  const access = await getAccess();

  if (!access.signedIn) {
    redirect("/login");
  }
  if (!access.profile) {
    redirect("/dashboard");
  }

  const profile = access.profile;
  const isMember = profile.account_status === "member_active";

  if (isMember && !profile.trading_account_number) {
    redirect("/dashboard");
  }

  const viewer: Viewer = { tier: access.tier, isMember, isAdmin: profile.is_admin };
  const locked = !canAccess(feature, viewer);

  if (locked && onLocked === "redirect") {
    redirect("/upgrade");
  }
  if (!locked && log) {
    logEventAfter(profile.id, "feature_view", { feature });
  }

  return { profile, tier: access.tier, viewer, locked };
}
