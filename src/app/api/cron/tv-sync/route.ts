import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { grantTVAccess, revokeTVAccess } from "@/lib/tv/client";
import type { AccountStatus } from "@/lib/trial/status";

const ACTIVE = new Set<AccountStatus>(["trial_active", "re_trial_active", "member_active"]);

// Runs daily at 02:00 UTC (configured in vercel.json).
// Reconciles every profile that has a tradingview_username — safety net for
// any webhooks that were missed (deploy gaps, transient failures, etc.).
export async function GET(req: NextRequest) {
  // Vercel injects Authorization: Bearer <CRON_SECRET> for cron invocations.
  // We also accept the same header for manual test calls.
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Service role bypasses RLS — acceptable here because this is a server-only
  // cron route, never reachable by a browser, and only reads profiles.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: users, error } = await admin
    .from("profiles")
    .select("tradingview_username, account_status, trial_ends_at")
    .not("tradingview_username", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = users ?? [];
  const results = await Promise.allSettled(
    rows.map(async (u) => {
      const status = u.account_status as AccountStatus;
      const tv     = u.tradingview_username as string;

      if (ACTIVE.has(status)) {
        const trialEndsAt = status === "member_active" ? null : u.trial_ends_at;
        return grantTVAccess(tv, trialEndsAt);
      } else {
        return revokeTVAccess(tv);
      }
    })
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed    = results.filter((r) => r.status === "rejected").length;

  console.log(`[cron/tv-sync] ${rows.length} users — ${succeeded} ok, ${failed} failed`);
  return NextResponse.json({ total: rows.length, succeeded, failed });
}
