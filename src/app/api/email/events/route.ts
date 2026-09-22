import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/journal/api";

// SendPulse's SMTP webhook lands here (design doc 2026-09-22 §4).
//
// SendPulse signs nothing, so the shared secret rides in the URL — the webhook
// is registered once, by hand, as
//   https://app.marketmakersfx.net/api/email/events?k=<EMAIL_EVENTS_SECRET>
// and a request without it is answered 401 before anything is read. The
// migration's ops notes have the full registration steps.
//
// Three rules shape everything below:
//
//  1. NEVER 500. SendPulse batches events every 30 seconds (or every 500
//     events) and documents no retry policy, so a failed POST is data we
//     simply never see again. Anything we cannot parse or write is counted as
//     `ignored` and answered 200.
//  2. IDEMPOTENT. The unique key (provider_id, event, occurred_at) plus
//     ignoreDuplicates means a re-posted batch writes nothing twice, so a
//     retry — theirs or ours — can never inflate a KPI.
//  3. KEEP THE EVIDENCE. An event we cannot match to a send is still stored,
//     with its whole payload in `raw`. An orphan row is recoverable; a
//     discarded event is not.
//
// Matching order (§0.4): provider_id first — SendPulse's own send id, which
// the rail stamped on email_sends at send time. If that misses (the KB shows a
// numeric message_id where the API returns a string one, so the two may not be
// the same identifier), fall back to the recipient's profile + the exact
// subject + a send within a day either side of the event.

export const dynamic = "force-dynamic";

/** SendPulse event names → the nine names email_events stores. */
const EVENT_NAMES: Record<string, string> = {
  delivered: "delivered",
  delivery: "delivered",
  undelivered: "undelivered",
  not_delivered: "undelivered",
  opened: "opened",
  open: "opened",
  clicked: "clicked",
  click: "clicked",
  link_clicked: "clicked",
  spam: "spam",
  marked_as_spam: "spam",
  spam_complaint: "spam",
  complaint: "spam",
  unsubscribed: "unsubscribed",
  unsubscribe: "unsubscribed",
  resubscribed: "resubscribed",
  resubscribe: "resubscribed",
  hard_bounce: "hard_bounce",
  hard_bounced: "hard_bounce",
  hardbounce: "hard_bounce",
  soft_bounce: "soft_bounce",
  soft_bounced: "soft_bounce",
  softbounce: "soft_bounce",
};

/**
 * One SendPulse event name, in any of its spellings ("not delivered",
 * "marked as spam", "Hard Bounce"), as the name the check constraint accepts —
 * or null for anything we don't recognise, which is ignored rather than
 * guessed at.
 */
export function normalizeEvent(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return EVENT_NAMES[key] ?? null;
}

interface SendPulseEvent {
  event?: unknown;
  timestamp?: unknown;
  message_id?: unknown;
  recipient?: unknown;
  sender?: unknown;
  subject?: unknown;
  url?: unknown;
}

interface Pending {
  event: string;
  providerId: string | null;
  recipient: string | null;
  subject: string | null;
  url: string | null;
  occurredAt: string;
  raw: SendPulseEvent;
}

function str(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/** Unix seconds → ISO. Missing or nonsense falls back to arrival time. */
function occurredAt(raw: unknown): string {
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (typeof n === "number" && Number.isFinite(n) && n > 0) {
    // Tolerate milliseconds: anything past the year 2286 in seconds is ms.
    const ms = n > 1e11 ? n : n * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.EMAIL_EVENTS_SECRET;
  if (!secret) return false;
  // Read from req.url rather than nextUrl: this handler is also exercised with
  // a plain Request, and an auth check that throws is an auth check that fails
  // open in the wrong direction.
  const k = new URL(req.url).searchParams.get("k");
  return k === secret;
}

const MAX_EVENTS = 1000;
const DAY_S = 86400;

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ received: 0, matched: 0, ignored: 1 });
  }

  const incoming: SendPulseEvent[] = (Array.isArray(body) ? body : [body]).slice(0, MAX_EVENTS);
  const received = incoming.length;

  // Parse first, so an unknown event name costs nothing downstream.
  const pending: Pending[] = [];
  let ignored = 0;
  const seen = new Set<string>();
  for (const e of incoming) {
    const event = normalizeEvent(e?.event);
    if (!event) {
      ignored += 1;
      continue;
    }
    const providerId = str(e.message_id);
    const at = occurredAt(e.timestamp);
    // The database would ignore this duplicate too; dropping it here keeps the
    // counts honest and the payload small.
    const key = `${providerId}|${event}|${at}`;
    if (seen.has(key)) {
      ignored += 1;
      continue;
    }
    seen.add(key);
    pending.push({
      event,
      providerId,
      recipient: str(e.recipient)?.toLowerCase() ?? null,
      subject: str(e.subject),
      url: event === "clicked" ? str(e.url) : null,
      occurredAt: at,
      raw: e,
    });
  }

  if (!pending.length) return NextResponse.json({ received, matched: 0, ignored });

  const db = serviceClient();

  // Pass 1 — one sweep for the whole batch on SendPulse's own id.
  const bySend = new Map<string, string>();
  const ids = [...new Set(pending.map((p) => p.providerId).filter((v): v is string => !!v))];
  if (ids.length) {
    const { data } = await db.from("email_sends").select("id, provider_id").in("provider_id", ids);
    for (const row of (data ?? []) as { id: string; provider_id: string }[]) {
      bySend.set(row.provider_id, row.id);
    }
  }

  // Pass 2 — the fallback, only for what pass 1 missed. One profile sweep,
  // then one narrow lookup per still-unmatched event.
  const orphans = pending.filter((p) => !p.providerId || !bySend.has(p.providerId));
  const userByEmail = new Map<string, string>();
  const emails = [...new Set(orphans.map((p) => p.recipient).filter((v): v is string => !!v))];
  if (emails.length) {
    const { data } = await db.from("profiles").select("id, email").in("email", emails);
    for (const row of (data ?? []) as { id: string; email: string }[]) {
      if (row.email) userByEmail.set(row.email.toLowerCase(), row.id);
    }
  }

  const fallbackSend = new Map<Pending, string>();
  for (const p of orphans) {
    const userId = p.recipient ? userByEmail.get(p.recipient) : undefined;
    if (!userId || !p.subject) continue;
    const at = Date.parse(p.occurredAt) / 1000;
    const { data } = await db
      .from("email_sends")
      .select("id, sent_at")
      .eq("user_id", userId)
      .eq("subject", p.subject)
      .gte("sent_at", new Date((at - DAY_S) * 1000).toISOString())
      .lte("sent_at", new Date((at + DAY_S) * 1000).toISOString())
      .order("sent_at", { ascending: false })
      .limit(1);
    const hit = (data ?? [])[0] as { id: string } | undefined;
    if (hit) fallbackSend.set(p, hit.id);
  }

  const rows = pending.map((p) => ({
    send_id: (p.providerId ? bySend.get(p.providerId) : undefined) ?? fallbackSend.get(p) ?? null,
    provider_id: p.providerId,
    event: p.event,
    url: p.url,
    occurred_at: p.occurredAt,
    raw: p.raw as unknown as Record<string, unknown>,
  }));
  // "matched" is how many events we could tie to a send — the number worth
  // watching after go-live, because a batch that matches nothing means the
  // provider_id join is wrong and the fallback is carrying everything.
  const matched = rows.filter((r) => r.send_id).length;

  const { data: written, error } = await db
    .from("email_events")
    .upsert(rows, { onConflict: "provider_id,event,occurred_at", ignoreDuplicates: true })
    .select("id");

  if (error) {
    // Logged, never raised: a 500 here loses the batch for good.
    console.error("[api/email/events] insert failed:", error.message);
    return NextResponse.json({ received, matched: 0, ignored: ignored + rows.length });
  }

  const inserted = (written ?? []).length;
  return NextResponse.json({
    received,
    matched,
    ignored: ignored + (rows.length - inserted),
  });
}
