import "server-only";

// One code path for sending transactional email through SendPulse's SMTP API.
// Reuses the SENDPULSE_API_ID/SECRET OAuth flow already used by the address-
// book sync. Best-effort: every failure resolves to { ok:false } rather than
// throwing, so callers never break on a mail hiccup.

const SP_OAUTH = "https://api.sendpulse.com/oauth/access_token";
const SP_SMTP = "https://api.sendpulse.com/smtp/emails";
const SP_ADDRESSBOOKS = "https://api.sendpulse.com/addressbooks";

export interface EmailAddress {
  name: string;
  email: string;
}

export interface EmailAttachment {
  /** Filename shown to the recipient, e.g. "xauusd_thesis.pdf". */
  name: string;
  /** Raw file bytes, base64-encoded. */
  contentBase64: string;
}

export interface SendEmailParams {
  to: EmailAddress;
  from: EmailAddress;
  subject: string;
  /** Raw HTML — this helper base64-encodes it for SendPulse. */
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface SendResult {
  ok: boolean;
  detail: unknown;
}

async function sendpulseToken(): Promise<string | null> {
  const id = process.env.SENDPULSE_API_ID;
  const secret = process.env.SENDPULSE_API_SECRET;
  if (!id || !secret) return null;
  const r = await fetch(SP_OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
    }),
  });
  const j = await r.json().catch(() => ({}));
  return j?.access_token ?? null;
}

export async function sendEmail(params: SendEmailParams): Promise<SendResult> {
  try {
    const token = await sendpulseToken();
    if (!token) return { ok: false, detail: "no sendpulse token" };

    const email: Record<string, unknown> = {
      subject: params.subject,
      from: { name: params.from.name, email: params.from.email },
      to: [{ name: params.to.name, email: params.to.email }],
      // SendPulse expects the HTML body base64-encoded.
      html: Buffer.from(params.html, "utf8").toString("base64"),
    };
    if (params.text) email.text = params.text;

    if (params.attachments?.length) {
      // Binary attachments go as an object keyed by filename → base64 content.
      const bin: Record<string, string> = {};
      for (const a of params.attachments) bin[a.name] = a.contentBase64;
      email.attachments_binary = bin;
    }

    const res = await fetch(SP_SMTP, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });
    const detail = await res.json().catch(() => ({}));
    return { ok: res.ok && detail?.result !== false, detail };
  } catch (e) {
    return { ok: false, detail: String(e) };
  }
}

// Upsert a contact into a SendPulse address book with variables. Adding an
// email that already exists UPDATES its variables, so repeat calls refresh
// usage fields. Best-effort: never throws — callers tag fire-and-forget.
export async function addContactToBook(
  bookId: string,
  email: string,
  variables: Record<string, string>
): Promise<SendResult> {
  try {
    const token = await sendpulseToken();
    if (!token) return { ok: false, detail: "no sendpulse token" };

    const res = await fetch(`${SP_ADDRESSBOOKS}/${bookId}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ emails: [{ email, variables }] }),
    });
    const detail = await res.json().catch(() => ({}));
    return { ok: res.ok && detail?.result !== false, detail };
  } catch (e) {
    return { ok: false, detail: String(e) };
  }
}

export interface BookContact {
  email: string;
  variables: Record<string, string>;
}

// Bulk upsert contacts into a book, chunked to respect the API. Adding an
// existing email updates its variables (upsert), so this is safe to run
// repeatedly — it's how the status-sync cron keeps segmentation fields fresh.
export async function addContactsToBook(
  bookId: string,
  contacts: BookContact[]
): Promise<{ ok: boolean; added: number; detail: unknown }> {
  if (!contacts.length) return { ok: true, added: 0, detail: "no contacts" };
  try {
    const token = await sendpulseToken();
    if (!token) return { ok: false, added: 0, detail: "no sendpulse token" };

    const CHUNK = 100;
    let added = 0;
    let lastDetail: unknown = null;
    for (let i = 0; i < contacts.length; i += CHUNK) {
      const chunk = contacts.slice(i, i + CHUNK);
      const res = await fetch(`${SP_ADDRESSBOOKS}/${bookId}/emails`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ emails: chunk }),
      });
      lastDetail = await res.json().catch(() => ({}));
      if (res.ok && (lastDetail as { result?: boolean })?.result !== false) {
        added += chunk.length;
      }
    }
    return { ok: added === contacts.length, added, detail: lastDetail };
  } catch (e) {
    return { ok: false, added: 0, detail: String(e) };
  }
}
