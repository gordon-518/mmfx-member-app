import type { SupabaseClient } from "@supabase/supabase-js";

// The support agent's line in the 9am Telegram DM (see
// src/app/api/cron/daily-stats/route.ts).

export interface SupportStats {
  replies: number;
  handoffs: number;
  waiting: number;
  /** Outgoing rows logged but never confirmed sent — see UNDELIVERED_AFTER_MS. */
  undelivered: number;
  medianSeconds: number | null;
}

/** An outgoing message is logged before it is sent, so a row is only
 * suspicious once it has stayed unconfirmed for a few minutes. */
const UNDELIVERED_AFTER_MS = 5 * 60_000;
/** Enough latency samples for a median; also keeps the one non-count query
 * under PostgREST's 1000-row default rather than silently truncating. */
const LATENCY_SAMPLE = 1000;

export function supportLine(s: SupportStats): string {
  if (!s.replies && !s.handoffs && !s.waiting && !s.undelivered) {
    return "<b>Support agent:</b> no messages in the last 24h";
  }
  const line = `<b>Support agent:</b> ${s.replies} replies · ${s.handoffs} handed to Amelia · ${s.waiting} waiting` +
    (s.medianSeconds != null ? ` · median reply ${s.medianSeconds}s` : "");
  // Worth interrupting the daily numbers for: these members were never
  // answered and nobody was told at the time.
  return s.undelivered ? `${line}\n⚠️ ${s.undelivered} logged but never confirmed sent` : line;
}

export async function supportStats(db: SupabaseClient, since: Date): Promise<SupportStats> {
  const sinceIso = since.toISOString();
  const staleBefore = new Date(Date.now() - UNDELIVERED_AFTER_MS).toISOString();
  const events = () => db.from("support_events").select("id", { count: "exact", head: true });
  // Counts, not row fetches: an earlier feature in this codebase undercounted
  // because a plain select caps at 1000 rows.
  const [replies, handoffs, waiting, undelivered, latency] = await Promise.all([
    events().eq("kind", "reply").gte("created_at", sinceIso),
    events().eq("kind", "handoff").gte("created_at", sinceIso),
    db.from("support_chats").select("contact_id", { count: "exact", head: true }).eq("state", "needs_amelia"),
    events().in("kind", ["reply", "handoff"]).is("delivered_at", null).gte("created_at", sinceIso).lt("created_at", staleBefore),
    db.from("support_events").select("latency_ms").eq("kind", "reply").gte("created_at", sinceIso)
      .not("latency_ms", "is", null).order("created_at", { ascending: false }).limit(LATENCY_SAMPLE),
  ]);

  const lat = ((latency.data ?? []) as { latency_ms: number | null }[])
    .map((r) => r.latency_ms).filter((n): n is number => n != null).sort((a, b) => a - b);

  return {
    replies: replies.count ?? 0,
    handoffs: handoffs.count ?? 0,
    waiting: waiting.count ?? 0,
    undelivered: undelivered.count ?? 0,
    medianSeconds: lat.length ? Math.round(lat[Math.floor(lat.length / 2)] / 1000) : null,
  };
}
