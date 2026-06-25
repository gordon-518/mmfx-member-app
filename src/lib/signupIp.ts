import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

// Records the IP at first magic-link confirm as a soft trial-abuse signal.
// Best-effort, service-role, set-once (only when signup_ip is still null).

let admin: SupabaseClient | null = null;
function adminClient(): SupabaseClient {
  if (!admin) {
    admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return admin;
}

export function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || req.headers.get("x-vercel-forwarded-for") || null;
}

export async function recordSignupIp(userId: string | undefined, ip: string | null): Promise<void> {
  if (!userId || !ip) return;
  try {
    await adminClient()
      .from("profiles")
      .update({ signup_ip: ip })
      .eq("id", userId)
      .is("signup_ip", null);
  } catch {
    /* best-effort — never block login */
  }
}
