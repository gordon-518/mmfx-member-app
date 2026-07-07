import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { serviceClient } from "@/lib/journal/api";
import { runReportForUser } from "@/lib/journal/coach";

// Daily AI-report worker. Triggered by Supabase pg_cron + pg_net at 22:30 UTC
// (see the journal_reports migration). Generates today's coaching report for
// every user with a connected account who doesn't have one yet.
//
// Same self-chaining shape as the sync worker: derive the work-list from state
// (no separate queue needed), process a concurrency-capped batch, and chain a
// follow-up invocation while a backlog remains — so thousands of per-user model
// calls drain across invocations instead of timing out in one.

export const maxDuration = 300;

const BATCH = 20;
const CONCURRENCY = 4;
const TIME_BUDGET_MS = 240_000;
const MAX_CHAIN_DEPTH = 10;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** User ids with a connected account but no report for `date` yet. */
async function pendingUsers(
  db: ReturnType<typeof serviceClient>,
  date: string,
  limit: number
): Promise<string[]> {
  const [{ data: accounts }, { data: done }] = await Promise.all([
    db.from("journal_accounts").select("user_id").eq("state", "deployed"),
    db.from("journal_reports").select("user_id").eq("report_date", date),
  ]);
  const haveReport = new Set((done ?? []).map((r) => r.user_id as string));
  const seen = new Set<string>();
  const pending: string[] = [];
  for (const a of accounts ?? []) {
    const uid = a.user_id as string;
    if (haveReport.has(uid) || seen.has(uid)) continue;
    seen.add(uid);
    pending.push(uid);
    if (pending.length >= limit) break;
  }
  return pending;
}

async function runPool(
  db: ReturnType<typeof serviceClient>,
  userIds: string[],
  date: string,
  counts: { done: number; skipped: number }
): Promise<void> {
  let next = 0;
  const workers = Array.from(
    { length: Math.min(CONCURRENCY, userIds.length) },
    async () => {
      while (next < userIds.length) {
        const uid = userIds[next++];
        const report = await runReportForUser(db, uid, date);
        if (report) counts.done += 1;
        else counts.skipped += 1;
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
  const date = today();
  const startedAt = Date.now();
  const counts = { done: 0, skipped: 0 };

  while (Date.now() - startedAt < TIME_BUDGET_MS) {
    const batch = await pendingUsers(db, date, BATCH);
    if (batch.length === 0) break;
    await runPool(db, batch, date, counts);
  }

  const remaining = (await pendingUsers(db, date, 1)).length;
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (remaining > 0 && depth < MAX_CHAIN_DEPTH && base) {
    after(async () => {
      try {
        await fetch(`${base}/api/journal/cron/report`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.CRON_SECRET}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ depth: depth + 1 }),
        });
      } catch {
        // next daily tick picks up the rest
      }
    });
  }

  return NextResponse.json({ ok: true, ...counts, hasMore: remaining > 0, depth });
}
