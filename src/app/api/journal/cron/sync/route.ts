import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { serviceClient } from "@/lib/journal/api";
import { syncAccount } from "@/lib/journal/sync";
import type { JournalAccountRow } from "@/lib/journal/types";

// The sync worker. Triggered every 15 min by Supabase pg_cron + pg_net (same
// convention as daily-stats — consumes no Vercel Hobby cron slot), and nudged
// by manual "Sync now" requests.
//
//   1. enqueue jobs for deployed accounts whose last sync is stale (> 4 h)
//   2. claim batches via fn_claim_sync_jobs (FOR UPDATE SKIP LOCKED — safe
//      under concurrent invocations)
//   3. sync each claimed account (concurrency-capped)
//   4. failed jobs re-queue with backoff up to MAX_ATTEMPTS; permanent
//      failures surface on the account card via sync_error
//   5. if queued jobs remain near the time budget, self-chain a follow-up
//      invocation (depth-capped)
//
// Safe to double-fire: claiming is atomic and syncs are idempotent (deal
// upserts + full-position trade rebuilds).

export const maxDuration = 300;

// Once-daily cadence: MetaApi bills a 6-hour minimum block per deploy, so
// syncing more than once per ~6h would overlap blocks and lose the saving.
// ~20h keeps a steady once-a-day rhythm with margin (see sync.ts §COST).
const STALE_SYNC = "20 hours";
// Each sync now deploys → waits for the broker connection (up to ~90s) → reads
// → undeploys, so batches are smaller and concurrency lower than the old
// always-on path. A claimed batch's worst case (CLAIM_BATCH/CONCURRENCY ×
// connect-timeout) must fit under maxDuration; we stop claiming new batches
// once TIME_BUDGET is spent so the last batch can't overrun the 300s cap.
const CLAIM_BATCH = 6;
const CONCURRENCY = 3;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5 * 60_000;
const TIME_BUDGET_MS = 120_000; // stop claiming here; worst batch ~180s ⇒ <300s
const MAX_CHAIN_DEPTH = 8;
// A 'running' job older than this was orphaned by a killed invocation — reap it.
const STALE_RUNNING_MS = 15 * 60_000;

interface SyncJob {
  id: number;
  account_id: string;
  attempts: number;
}

async function processJob(
  db: ReturnType<typeof serviceClient>,
  job: SyncJob
): Promise<"done" | "retried" | "failed"> {
  const { data: account } = await db
    .from("journal_accounts")
    .select()
    .eq("id", job.account_id)
    .maybeSingle();

  // Account gone or no longer syncable — close the job out.
  if (!account || !["deployed", "connecting"].includes(account.state)) {
    await db
      .from("journal_sync_jobs")
      .update({ status: "done", finished_at: new Date().toISOString() })
      .eq("id", job.id);
    return "done";
  }

  const outcome = await syncAccount(db, account as JournalAccountRow);

  if (outcome.ok) {
    await db
      .from("journal_sync_jobs")
      .update({ status: "done", finished_at: new Date().toISOString() })
      .eq("id", job.id);
    return "done";
  }

  const attempts = job.attempts + 1;
  if (!outcome.permanent && attempts < MAX_ATTEMPTS) {
    // Transient — back off and retry.
    await db
      .from("journal_sync_jobs")
      .update({
        status: "queued",
        attempts,
        scheduled_at: new Date(Date.now() + RETRY_DELAY_MS).toISOString(),
        error: outcome.error,
      })
      .eq("id", job.id);
    return "retried";
  }

  // Out of attempts (or unfixable) — fail the job, surface on the account.
  await db
    .from("journal_sync_jobs")
    .update({
      status: "failed",
      attempts,
      finished_at: new Date().toISOString(),
      error: outcome.error,
    })
    .eq("id", job.id);
  await db
    .from("journal_accounts")
    .update({ sync_error: outcome.error })
    .eq("id", job.account_id);
  return "failed";
}

/** Run jobs with a fixed-size worker pool. */
async function runPool(
  db: ReturnType<typeof serviceClient>,
  jobs: SyncJob[],
  counts: Record<"done" | "retried" | "failed", number>
): Promise<void> {
  let next = 0;
  const workers = Array.from(
    { length: Math.min(CONCURRENCY, jobs.length) },
    async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        counts[await processJob(db, job)] += 1;
      }
    }
  );
  await Promise.all(workers);
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let depth = 0;
  try {
    const body = (await req.json()) as { depth?: number };
    depth = Math.max(0, Math.min(Number(body?.depth) || 0, MAX_CHAIN_DEPTH));
  } catch {
    // empty body (pg_net) — depth 0
  }

  const db = serviceClient();
  const startedAt = Date.now();
  const counts = { done: 0, retried: 0, failed: 0 };

  // Reap orphaned 'running' jobs (a prior invocation killed mid-sync) back to
  // queued — otherwise their account is blocked from ever re-enqueuing.
  await db
    .from("journal_sync_jobs")
    .update({ status: "queued" })
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - STALE_RUNNING_MS).toISOString());

  const { data: enqueued, error: enqueueErr } = await db.rpc(
    "fn_enqueue_due_sync_jobs",
    { p_stale: STALE_SYNC }
  );
  if (enqueueErr) {
    return NextResponse.json({ error: enqueueErr.message }, { status: 500 });
  }

  // Claim → process until the queue is dry or the time budget is spent.
  while (Date.now() - startedAt < TIME_BUDGET_MS) {
    const { data: jobs, error: claimErr } = await db.rpc("fn_claim_sync_jobs", {
      p_limit: CLAIM_BATCH,
    });
    if (claimErr) {
      return NextResponse.json({ error: claimErr.message }, { status: 500 });
    }
    if (!jobs || jobs.length === 0) break;
    await runPool(db, jobs as SyncJob[], counts);
  }

  // Anything still due? Chain a follow-up worker (depth-capped) so a big
  // backlog drains across invocations instead of being dropped.
  const { count: remaining } = await db
    .from("journal_sync_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "queued")
    .lte("scheduled_at", new Date().toISOString());

  const base = process.env.NEXT_PUBLIC_APP_URL;
  if ((remaining ?? 0) > 0 && depth < MAX_CHAIN_DEPTH && base) {
    after(async () => {
      try {
        await fetch(`${base}/api/journal/cron/sync`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.CRON_SECRET}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ depth: depth + 1 }),
        });
      } catch {
        // Next cron tick drains the rest.
      }
    });
  }

  return NextResponse.json({
    ok: true,
    enqueued: enqueued ?? 0,
    ...counts,
    remaining: remaining ?? 0,
    depth,
  });
}
