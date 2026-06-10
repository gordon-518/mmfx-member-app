import "server-only";

import { redirect } from "next/navigation";
import { getAccess, type AccessProfile } from "./getAccess";

/**
 * Guard for gated pages. Call it at the top of any page/layout that serves
 * member content:
 *
 *   const profile = await requireFull();
 *
 * Not signed in -> /login. Signed in but not Full (including a missing
 * profile — fail closed) -> redirectTo (default /upgrade). Only returns,
 * with the profile, when access is granted.
 */
export async function requireFull(
  redirectTo: string = "/upgrade"
): Promise<AccessProfile> {
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

  return access.profile;
}
