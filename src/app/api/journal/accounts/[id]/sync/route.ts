import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireMemberApi, serviceClient } from "@/lib/journal/api";

// POST /api/journal/accounts/:id/sync — manual "Sync now".
//
// Each sync DEPLOYS the account at MetaApi = a fresh 6-hour minimum billing
// block, so the cooldown is aligned with that block (not the old 5 min, which
// let a member start ~288 billing blocks/day by mashing the button). Fresh data
// also auto-syncs daily. Enqueues a job + nudges the worker to start now.

const MANUAL_SYNC_COOLDOWN_MS = 6 * 60 * 60_000; // one MetaApi billing block

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireMemberApi();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  const supabase = await createClient();

  const { data: account } = await supabase
    .from("journal_accounts")
    .select("id, state, last_synced_at")
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

  // One active job at a time (also enforced by a partial unique index).
  const { data: activeJob } = await db
    .from("journal_sync_jobs")
    .select("id")
    .eq("account_id", id)
    .in("status", ["queued", "running"])
    .limit(1)
    .maybeSingle();
  if (activeJob) {
    return NextResponse.json(
      { error: "A sync is already in progress." },
      { status: 429 }
    );
  }

  // Cost guard: refuse a manual sync within one MetaApi billing block of the last
  // successful sync — otherwise each click starts another 6h block.
  if (
    account.last_synced_at &&
    Date.now() - new Date(account.last_synced_at).getTime() < MANUAL_SYNC_COOLDOWN_MS
  ) {
    return NextResponse.json(
      { error: "Synced recently — your data refreshes automatically. You can sync again in a few hours." },
      { status: 429 }
    );
  }

  const { error } = await db.from("journal_sync_jobs").insert({ account_id: id });
  if (error) {
    // Raced against the partial unique index — a sync is already pending.
    return NextResponse.json(
      { error: "A sync is already in progress." },
      { status: 429 }
    );
  }

  // Nudge the worker after the response is sent (fire-and-forget).
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (base && process.env.JOURNAL_CRON_SECRET) {
    after(async () => {
      try {
        await fetch(`${base}/api/journal/cron/sync`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.JOURNAL_CRON_SECRET}`,
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
