import "server-only";

import { getAccess } from "@/lib/access";
import { canAccess } from "@/lib/access/features";

/**
 * Can the caller use the Fundamental Desk? Same rule as the page gate and
 * /api/fundamental/send-copy: a signed-in account that the feature map opens
 * the desk for, or the admin. The desk's own data is public, but these routes
 * are members-only so the member app never becomes an open relay for it.
 */
export async function deskAuthorized(): Promise<boolean> {
  const access = await getAccess();
  if (!access.signedIn || !access.profile) return false;
  return (
    canAccess("fundamental-desk", {
      tier: access.memberTier,
      isAdmin: access.profile.is_admin,
    }) || access.profile.is_admin
  );
}
