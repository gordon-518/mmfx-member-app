import "server-only";

import { redirect } from "next/navigation";
import { getAccess, type AccessProfile } from "./getAccess";
import { logEventAfter } from "@/lib/events";
import type { FeatureKey } from "./featureKeys";

/**
 * Guard for gated pages. Call it at the top of any page/layout that serves
 * member content:
 *
 *   const profile = await requireFull();
 *
 * Not signed in -> /login. Signed in but not Full (including a missing
 * profile — fail closed) -> redirectTo (default /upgrade). Only returns,
 * with the profile, when access is granted.
 *
 * Pass `feature` to record a feature_view event for the granted view
 * (conversion-fix 1.3): `requireFull({ feature: "daily-analysis" })`. Denied
 * visits aren't counted. The string form `requireFull("/somewhere")` still
 * sets redirectTo, for existing callers.
 */
export async function requireFull(
  opts: string | { redirectTo?: string; feature?: FeatureKey } = "/upgrade"
): Promise<AccessProfile> {
  const { redirectTo = "/upgrade", feature } =
    typeof opts === "string" ? { redirectTo: opts, feature: undefined } : opts;

  // Path-only: "//evil.com" or "https://evil.com" in a Location header is an
  // open redirect. This is a reusable primitive — guard it at the source.
  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    throw new Error(
      `requireFull: redirectTo must be an app path, got "${redirectTo}"`
    );
  }

  const access = await getAccess();

  if (!access.signedIn) {
    redirect("/login");
  }

  if (access.tier !== "Full" || !access.profile) {
    redirect(redirectTo);
  }

  // Funded members must have a trading account number on file before they get
  // full access (so an inactive/switched account never removes an active member
  // by mistake). Trials are exempt. The dashboard renders the gate itself; every
  // other member page bounces there. /dashboard uses getAccess (not requireFull),
  // so there's no redirect loop.
  if (
    access.profile.account_status === "member_active" &&
    !access.profile.trading_account_number
  ) {
    redirect("/dashboard");
  }

  // Logged after the response, and deduped per user + feature per 30 minutes
  // in the database, so a refresh never costs a render or a duplicate row.
  if (feature) logEventAfter(access.profile.id, "feature_view", { feature });

  return access.profile;
}
