import "server-only";

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getAccess, type AccessProfile } from "@/lib/access/getAccess";

// Shared helpers for the journal API routes.

/**
 * JSON-flavoured access guard (requireFull redirects — wrong for APIs).
 * Returns the Full-tier profile, or a NextResponse to return as-is.
 */
export async function requireFullApi(): Promise<
  { profile: AccessProfile } | { response: NextResponse }
> {
  const access = await getAccess();
  if (!access.signedIn) {
    return {
      response: NextResponse.json({ error: "Not signed in" }, { status: 401 }),
    };
  }
  if (access.tier !== "Full" || !access.profile) {
    return {
      response: NextResponse.json(
        { error: "Full access required" },
        { status: 403 }
      ),
    };
  }
  return { profile: access.profile };
}

/**
 * Admin-only variant of requireFullApi. While the AI Trading Journal is in
 * staged rollout it's restricted to admin accounts — the nav entry is hidden
 * for everyone else, and this guard stops non-admins reaching the API by URL.
 */
export async function requireAdminApi(): Promise<
  { profile: AccessProfile } | { response: NextResponse }
> {
  const guard = await requireFullApi();
  if ("response" in guard) return guard;
  if (!guard.profile.is_admin) {
    return {
      response: NextResponse.json(
        { error: "Admins only" },
        { status: 403 }
      ),
    };
  }
  return guard;
}

/** Service-role client — server-only, used by the worker and job enqueueing. */
export function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
