import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { grantTVAccess, revokeTVAccess } from "@/lib/tv/client";
import type { AccountStatus } from "@/lib/trial/status";

const ACTIVE = new Set<AccountStatus>(["trial_active", "re_trial_active", "member_active"]);

// Give the job room to finish. It reconciles every member with paced TradingView
// calls; firing all of them at once used to 429-storm TradingView AND blow past
// the Hobby ~10s default, killing the function mid-run. Pro allows up to 300s.
export const maxDuration = 300;

// Process members in small concurrent batches instead of all at once. TradingView
// has no official API and rate-limits (429) request bursts, so a wide fan-out
// caused per-script grant failures ("1/12 failed" alerts). A modest concurrency
// keeps us under the limit while still finishing well within maxDuration.
const BATCH_SIZE = 8;

async function inBatches<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    out.push(...(await Promise.allSettled(batch.map(fn))));
  }
  return out;
}

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
  const results = await inBatches(rows, BATCH_SIZE, async (u) => {
    const status = u.account_status as AccountStatus;
    const tv     = u.tradingview_username as string;

    if (ACTIVE.has(status)) {
      const trialEndsAt = status === "member_active" ? null : u.trial_ends_at;
      return grantTVAccess(tv, trialEndsAt);
    } else {
      return revokeTVAccess(tv);
    }
  });

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed    = results.filter((r) => r.status === "rejected").length;

  console.log(`[cron/tv-sync] ${rows.length} users — ${succeeded} ok, ${failed} failed`);
  return NextResponse.json({ total: rows.length, succeeded, failed });
}
