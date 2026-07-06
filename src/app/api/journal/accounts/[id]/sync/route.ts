import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireFullApi, serviceClient } from "@/lib/journal/api";

// POST /api/journal/accounts/:id/sync — manual "Sync now".
//
// Rate-limited to one request per account per 5 minutes (queued/running jobs
// or a very recent run both count). Enqueues a job and nudges the worker so
// the sync starts immediately instead of waiting for the next cron tick.

const RATE_LIMIT_MS = 5 * 60_000;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireFullApi();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  const supabase = await createClient();

  const { data: account } = await supabase
    .from("journal_accounts")
    .select("id, state")
    .eq("id", id)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  if (!["deployed", "connecting"].includes(account.state)) {
    return NextResponse.json(
      { error: "Account is not connected" },
      { status: 409 }
    );
  }

  const db = serviceClient();

  const { data: lastJob } = await db
    .from("journal_sync_jobs")
    .select("status, scheduled_at, started_at")
    .eq("account_id", id)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastJob) {
    const recent =
      new Date(lastJob.started_at ?? lastJob.scheduled_at).getTime() >
      Date.now() - RATE_LIMIT_MS;
    if (["queued", "running"].includes(lastJob.status) || recent) {
      return NextResponse.json(
        { error: "Sync already ran recently — try again in a few minutes" },
        { status: 429 }
      );
    }
  }

  const { error } = await db
    .from("journal_sync_jobs")
    .insert({ account_id: id });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Nudge the worker after the response is sent (fire-and-forget).
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (base && process.env.CRON_SECRET) {
    after(async () => {
      try {
        await fetch(`${base}/api/journal/cron/sync`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.CRON_SECRET}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ nudge: true }),
        });
      } catch {
        // Next cron tick will pick the job up anyway.
      }
    });
  }

  return NextResponse.json({ ok: true });
}
