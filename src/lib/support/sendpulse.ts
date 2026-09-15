import "server-only";
import type { ContactInfo, ThreadMessage } from "./types";

// Thin SendPulse Chatbots API client for the support agent (Telegram only).
// Uses SENDPULSE_API_ID / SENDPULSE_API_SECRET (already set for email).

const BASE = "https://api.sendpulse.com";
let token: { value: string; expiresAt: number } | null = null;

export function __resetTokenForTests() { token = null; }

interface TokenResponse { access_token?: string; expires_in?: number }

async function getToken(force = false): Promise<string> {
  if (!force && token && Date.now() < token.expiresAt) return token.value;
  const r = await fetch(`${BASE}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: process.env.SENDPULSE_API_ID,
      client_secret: process.env.SENDPULSE_API_SECRET,
    }),
  });
  const j = (await r.json().catch(() => ({}))) as TokenResponse;
  if (!j.access_token) throw new Error("SendPulse auth failed");
  token = { value: j.access_token, expiresAt: Date.now() + ((j.expires_in ?? 3600) - 60) * 1000 };
  return token.value;
}

interface SpResult { status: number; json: unknown }

async function sp(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}, attempt = 0): Promise<SpResult> {
  const r = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${await getToken(attempt > 0 && attempt < 2)}`, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (r.status === 401 && attempt === 0) return sp(path, init, 1);
  if ((r.status === 429 || r.status >= 500) && attempt < 2) {
    await new Promise((res) => setTimeout(res, 1000));
    return sp(path, init, 2);
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
  data?: { text?: unknown; caption?: unknown };
}

interface MessagesEnvelope { data?: RawMessage[] }

function toMessage(m: RawMessage): ThreadMessage {
  const d = m.data ?? {};
  const text = typeof d.text === "string" ? d.text : typeof d.caption === "string" ? d.caption : "";
  return {
    id: String(m.id),
    direction: m.direction === 1 ? "in" : "out",
    fromFlow: Boolean(m.block_id || m.send_block_id || m.chain_id || m.campaign_id),
    text,
    at: String(m.created_at),
  };
}

/** The latest `limit` messages, oldest first. The API returns newest first. */
export async function getMessages(contactId: string, limit = 15): Promise<ThreadMessage[]> {
  const { json } = await sp(`/telegram/chats/messages?contact_id=${encodeURIComponent(contactId)}`);
  const rows: RawMessage[] = Array.isArray((json as MessagesEnvelope)?.data) ? (json as MessagesEnvelope).data! : [];
  return rows.slice(0, limit).map(toMessage).reverse();
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
  const c = (json as ContactEnvelope)?.data;
  if (status !== 200 || !c) return null;
  const cd = c.channel_data ?? {};
  return {
    id: String(c.id),
    username: typeof cd.username === "string" ? cd.username : null,
    firstName: typeof cd.first_name === "string" ? cd.first_name : "",
    isBusiness: Boolean(c.business_connection),
    tags: (Array.isArray(c.tags) ? c.tags : [])
      .map((t) => (typeof t === "string" ? t : t?.name))
      .filter((t): t is string => typeof t === "string"),
  };
}

const post = async (path: string, body: unknown) => (await sp(path, { method: "POST", body })).status === 200;

export const send = (contactId: string, text: string) =>
  post("/telegram/contacts/send", { contact_id: contactId, message: { type: "text", text } });
export const setTag = (contactId: string, tag: string) =>
  post("/telegram/contacts/setTag", { contact_id: contactId, tags: [tag] });
export const deleteTag = (contactId: string, tag: string) =>
  post("/telegram/contacts/deleteTag", { contact_id: contactId, tag });
export const setPauseAutomation = (contactId: string, minutes: number) =>
  post("/telegram/contacts/setPauseAutomation", { contact_id: contactId, minutes });
export const openChat = (contactId: string) =>
  post("/telegram/contacts/openChat", { contact_id: contactId });
export const runFlow = (contactId: string, flowId: string) =>
  post("/telegram/flows/run", { contact_id: contactId, flow_id: flowId });
