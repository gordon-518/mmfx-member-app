import { NextResponse, after } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { adminDb } from "@/lib/channel/db";
import { supabaseStore } from "@/lib/support/store";
import { runBurst, handleOutgoing } from "@/lib/support/run";

// SendPulse chatbot webhook for @marketmakers18bot (Bot Settings -> Webhooks,
// events incoming_message + outgoing_message). SendPulse does not sign its
// webhooks, so the URL itself carries a long random ?key= secret, compared
// below in constant time against SUPPORT_WEBHOOK_SECRET. The route only
// stores events and kicks off work — run.ts re-reads the thread from the
// SendPulse API itself, so the webhook payload is never trusted for content.
export const runtime = "nodejs";
// 180s is load-bearing, not a round number. The worst-case path through
// run.ts's runBurst is: a fixed 20s debounce sleep, up to two model calls (a
// first draft that can take up to ~35s via agent.ts's defaultClient, plus a
// possible redraft up to REDRAFT_TIMEOUT_MS = 20s), and then — on a guard
// failure or a failed send — a handoff tail that can issue up to four
// SendPulse writes (setTag, setPauseAutomation, openChat, a holding-line
// send) plus a Telegram ping, each allowed up to roughly 10s. Add that up and
// the worst case lands around 140s (see run.ts's RUN_BUDGET_MS comment for
// the full accounting). At the platform default of 120s the function would
// be killed mid-handoff — after SendPulse has already been tagged/paused but
// before the chat state is saved or Amelia is pinged, i.e. a worse outcome
// than a slow response — so this route asks for real headroom above the
// worst case rather than the default.
export const maxDuration = 180;

/** Compares the `?key=` query parameter against SUPPORT_WEBHOOK_SECRET in
 * constant time. An unset secret or a missing/mismatched key both fail
 * closed — this must reject everything until the secret is configured. */
function keyOk(given: string | null): boolean {
  const want = process.env.SUPPORT_WEBHOOK_SECRET;
  if (!want || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** SendPulse's `date` field is a unix timestamp, sometimes in seconds and
 * sometimes in milliseconds. 1e12 milliseconds is the year 2001 and 1e12
 * seconds is the year 33658, so treating anything below that threshold as
 * seconds never misclassifies a real event. A missing or non-numeric date
 * falls back to "now" rather than producing an invalid ISO string. */
function eventTime(date: unknown): string {
  if (typeof date !== "number" || !Number.isFinite(date)) return new Date().toISOString();
  return new Date(date < 1e12 ? date * 1000 : date).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Defensive parse of the webhook body: SendPulse normally posts an array of
 * events, but a single object arrives too, and anything else (invalid JSON,
 * a bare string, null) must never throw — it just means there's nothing to
 * do. */
function parseEvents(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body.filter(isRecord);
  if (isRecord(body)) return [body];
  return [];
}

function getContactId(ev: Record<string, unknown>): string | null {
  const contact = ev.contact;
  if (!isRecord(contact)) return null;
  const id = contact.id;
  if (typeof id === "string" && id) return id;
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return null;
}

function getLastMessage(ev: Record<string, unknown>): string {
  const contact = ev.contact;
  if (!isRecord(contact)) return "";
  const text = contact.last_message;
  return typeof text === "string" ? text : "";
}

export async function POST(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!keyOk(key)) {
    // Wrong or missing key: reject before parsing the body or touching the
    // store — an attacker without the secret can cause no read or write.
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body: unknown = await req.json().catch(() => null);
  const events = parseEvents(body);
  const store = supabaseStore(adminDb());

  for (const ev of events) {
    const contactId = getContactId(ev);
    if (!contactId) continue;
    const title = ev.title;

    if (title === "incoming_message") {
      const text = getLastMessage(ev);
      const at = eventTime(ev.date);
      // Dedupe key: contact + event date + the text itself, hashed so a
      // long member message doesn't blow out the column. Two deliveries of
      // the same SendPulse event produce the same key; a genuinely new
      // message (different date and/or text) produces a different one.
      const dedupeKey = createHash("sha256")
        .update(`${contactId}|${String(ev.date ?? "")}|${text}`)
        .digest("hex")
        .slice(0, 32);

      const claimed = await store.log({
        contact_id: contactId,
        kind: "incoming",
        dedupe_key: dedupeKey,
        member_text: text,
      });

      // Only the delivery that wins the dedupe claim schedules a burst — a
      // retried/duplicate webhook for the same event must never start a
      // second runBurst for the same message.
      if (claimed.status === "ok") {
        after(async () => {
          try {
            await runBurst(contactId, { at, text });
          } catch {
            // runBurst already catches internally (run.ts) — this is belt
            // and braces so a truly unexpected throw here can never become
            // an unhandled rejection inside after(), which the platform
            // treats as an unhandled error.
          }
        });
      }
    } else if (title === "outgoing_message") {
      // No dedupe needed: handleOutgoing claims its own dedupe key per
      // matched reply (run.ts), so a retried webhook here is harmless.
      after(async () => {
        try {
          await handleOutgoing(contactId);
        } catch {
          // handleOutgoing already catches internally (run.ts) — same
          // belt-and-braces reasoning as above.
        }
      });
    }
  }

  // Always 200: SendPulse only needs to know delivery succeeded, and the
  // real work (if any) is scheduled in after() above.
  return NextResponse.json({ ok: true });
}
