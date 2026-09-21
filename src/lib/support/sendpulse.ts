import "server-only";
import type { ContactInfo, ThreadMessage } from "./types";

// Thin SendPulse Chatbots API client for the support agent (Telegram only).
// Uses SENDPULSE_API_ID / SENDPULSE_API_SECRET (already set for email).
//
// Contract (relied on by the orchestrator in run.ts): writes never throw —
// `true` only on confirmed success, `false` otherwise. `false` means not
// sent OR unknown (a timeout or 5xx may still have delivered it): callers
// must never re-send on false. Reads throw on failure, so a failed thread
// read never looks like an empty one; the one exception is `getContact`,
// which returns `null` for a 400/404 "not found" lookup but throws for
// any other failure (network/timeout/auth, or an unexpected non-200
// status). Every fetch has a timeout, and a POST is never retried after a
// 5xx — it may already have gone out, and a retry risks a duplicate reply
// to the member.

const BASE = "https://api.sendpulse.com";
const FETCH_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 1000;

let token: { value: string; expiresAt: number } | null = null;
let pending: Promise<string> | null = null;

export function __resetTokenForTests() {
  token = null;
  pending = null;
}

interface TokenResponse { access_token?: string; expires_in?: number }

async function getToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt) return token.value;
  // Concurrent callers (including one triggered by a 401 clearing the
  // cache while a refresh is already in flight) share one refresh.
  if (pending) return pending;
  pending = (async () => {
    const id = process.env.SENDPULSE_API_ID;
    const secret = process.env.SENDPULSE_API_SECRET;
    if (!id) throw new Error("SendPulse credentials missing: SENDPULSE_API_ID");
    if (!secret) throw new Error("SendPulse credentials missing: SENDPULSE_API_SECRET");
    const r = await fetch(`${BASE}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const j = (await r.json().catch(() => ({}))) as TokenResponse;
    if (r.status !== 200 || !j.access_token) throw new Error(`SendPulse auth failed: ${r.status}`);
    token = { value: j.access_token, expiresAt: Date.now() + ((j.expires_in ?? 3600) - 60) * 1000 };
    return token.value;
  })();
  try {
    return await pending;
  } finally {
    pending = null;
  }
}

interface SpResult { status: number; json: unknown }

async function sp(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown } = {},
  retry: { auth?: boolean; rateLimit?: boolean; serverError?: boolean } = {}
): Promise<SpResult> {
  const method = init.method ?? "GET";
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await getToken()}`, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  // Force a refresh only on the attempt immediately after a 401: clear the
  // cached token so the recursive call's getToken() has to fetch a new one,
  // rather than carrying a "force" flag that would re-fetch on every later
  // 429/5xx retry too.
  if (r.status === 401 && !retry.auth) {
    token = null;
    return sp(path, init, { ...retry, auth: true });
  }
  // A 429 means the request was never processed — safe to retry for any method.
  if (r.status === 429 && !retry.rateLimit) {
    await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
    return sp(path, init, { ...retry, rateLimit: true });
  }
  // A 5xx is retried only for GET — see the file-header contract for why.
  if (r.status >= 500 && method === "GET" && !retry.serverError) {
    await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
    return sp(path, init, { ...retry, serverError: true });
  }
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

interface RawMessage {
  id?: unknown;
  direction?: number;
  block_id?: unknown;
  send_block_id?: unknown;
  chain_id?: unknown;
  campaign_id?: unknown;
  created_at?: unknown;
  attachments?: unknown;
  data?: { text?: unknown; caption?: unknown; photo?: unknown; document?: unknown };
}

interface MessagesEnvelope { data?: RawMessage[] }

// True for a non-empty attachments array, or a non-null object with at
// least one key. Excludes `{}` and other truthy-but-empty values.
function hasAttachments(a: unknown): boolean {
  if (Array.isArray(a)) return a.length > 0;
  if (a !== null && typeof a === "object") return Object.keys(a).length > 0;
  return false;
}

function toMessage(m: RawMessage): ThreadMessage {
  const d = m.data ?? {};
  let text = typeof d.text === "string" ? d.text : typeof d.caption === "string" ? d.caption : "";
  // No text/caption but a photo, document or other attachment (deposit
  // screenshots are common here) — flag it so it isn't read as blank.
  const hasAttachment = hasAttachments(m.attachments) || Boolean(d.photo) || Boolean(d.document);
  if (!text && hasAttachment) text = "[attachment]";
  return {
    id: String(m.id),
    direction: m.direction === 1 ? "in" : "out",
    fromFlow: Boolean(m.block_id || m.send_block_id || m.chain_id || m.campaign_id),
    text,
    at: typeof m.created_at === "string" ? m.created_at : "",
  };
}

/** The latest `limit` messages, oldest first. The API returns newest first. */
export async function getMessages(contactId: string, limit = 15): Promise<ThreadMessage[]> {
  const { status, json } = await sp(`/telegram/chats/messages?contact_id=${encodeURIComponent(contactId)}`);
  const data = (json as MessagesEnvelope)?.data;
  if (status !== 200 || !Array.isArray(data)) {
    throw new Error(`SendPulse getMessages failed: ${status}`);
  }
  // One page is enough: SendPulse returns newest-first, well over 15 rows.
  // The id must be a string or number: toMessage's `String(m.id)` would
  // otherwise collapse a non-primitive id (e.g. an object) to the literal
  // "[object Object]" — harmless on its own, but now load-bearing, since
  // run.ts locks each answered message by its id (see the outcome dedupe
  // key in run.ts); every such row would collide onto one key.
  return data
    .filter((m) => (typeof m.id === "string" || typeof m.id === "number") && m.id !== "")
    .slice(0, limit)
    .map(toMessage)
    .reverse();
}

interface RawTag { name?: unknown }
interface RawContact {
  id?: unknown;
  channel_data?: { username?: unknown; first_name?: unknown };
  business_connection?: unknown;
  tags?: (string | RawTag)[];
}
interface ContactEnvelope { data?: RawContact }

export async function getContact(contactId: string): Promise<ContactInfo | null> {
  const { status, json } = await sp(`/telegram/contacts/get?id=${encodeURIComponent(contactId)}`);
  // 400/404 mean "no such contact" — genuinely not found. Any other
  // non-200 is an outage or similar and must not be mistaken for that.
  if (status === 400 || status === 404) return null;
  if (status !== 200) throw new Error(`SendPulse getContact failed: ${status}`);
  const c = (json as ContactEnvelope)?.data;
  if (!c) return null;
  const cd = c.channel_data ?? {};
  return {
    id: typeof c.id === "string" || typeof c.id === "number" ? String(c.id) : contactId,
    username: typeof cd.username === "string" ? cd.username : null,
    firstName: typeof cd.first_name === "string" ? cd.first_name : "",
    isBusiness: Boolean(c.business_connection),
    tags: (Array.isArray(c.tags) ? c.tags : [])
      .map((t) => (typeof t === "string" ? t : t?.name))
      .filter((t): t is string => typeof t === "string" && t.length > 0),
  };
}

async function post(path: string, body: unknown): Promise<boolean> {
  try {
    const { status, json } = await sp(path, { method: "POST", body });
    return status === 200 && (json as { success?: unknown })?.success !== false;
  } catch {
    return false;
  }
}

// parse_mode lives INSIDE the message object — verified against the live API;
// without it Telegram shows the tags as literal text. The text must already be
// valid HTML: build it with toTelegramHtml (format.ts), never by hand.
export const send = (contactId: string, text: string) =>
  post("/telegram/contacts/send", { contact_id: contactId, message: { type: "text", text, parse_mode: "HTML" } });
export const setTag = (contactId: string, tag: string) =>
  post("/telegram/contacts/setTag", { contact_id: contactId, tags: [tag] });
export const deleteTag = (contactId: string, tag: string) =>
  post("/telegram/contacts/deleteTag", { contact_id: contactId, tag });
export const setPauseAutomation = (contactId: string, minutes: number) =>
  post("/telegram/contacts/setPauseAutomation", { contact_id: contactId, minutes });
export const deletePauseAutomation = (contactId: string) =>
  post("/telegram/contacts/deletePauseAutomation", { contact_id: contactId });
export const openChat = (contactId: string) =>
  post("/telegram/contacts/openChat", { contact_id: contactId });
export const runFlow = (contactId: string, flowId: string) =>
  post("/telegram/flows/run", { contact_id: contactId, flow_id: flowId });
