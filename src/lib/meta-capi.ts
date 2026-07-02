import "server-only";
import crypto from "node:crypto";

// Meta Conversions API (server-side) — first-party conversion tracking.
//
// Sends the events the browser pixel can't reliably carry: signup conversions
// (survive ad-blockers/iOS) and the funded-account Purchase (an admin action
// with no browser context at all). All PII is SHA-256 hashed here before it
// leaves the server; only the pixel ID + access token are read from env.
//
// Env: NEXT_PUBLIC_META_PIXEL_ID, META_CAPI_TOKEN (secret), optional
// META_GRAPH_VERSION, and META_CAPI_TEST_CODE (set temporarily to route events
// to Events Manager → Test Events while validating).

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const TOKEN = process.env.META_CAPI_TOKEN;
const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v22.0";
const TEST_CODE = process.env.META_CAPI_TEST_CODE;

export type CapiUser = {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  externalId?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  fbc?: string | null; // _fbc cookie or reconstructed from fbclid
  fbp?: string | null; // _fbp cookie
};

export type CapiEvent = {
  eventName: string;
  eventId?: string; // for de-dup with a matching browser event (optional)
  eventSourceUrl?: string;
  actionSource?: "website" | "system_generated" | "email" | "phone_call" | "chat" | "other";
  user: CapiUser;
  customData?: Record<string, unknown>;
};

function sha256(value?: string | null): string | undefined {
  if (!value) return undefined;
  const norm = value.trim().toLowerCase();
  if (!norm) return undefined;
  return crypto.createHash("sha256").update(norm).digest("hex");
}

// Meta wants phone digits-only, country code included, no '+' or punctuation.
function normalizePhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/[^0-9]/g, "");
  return digits || undefined;
}

// Build Meta's `fbc` from a raw fbclid when the _fbc cookie isn't available
// (the click landed on the marketing-site domain, not the app subdomain).
export function fbcFromFbclid(fbclid?: string | null, ts?: number): string | undefined {
  if (!fbclid) return undefined;
  return `fb.1.${ts ?? Date.now()}.${fbclid}`;
}

// Fire-and-forget: never throws, never blocks a critical path. Returns a small
// result for logging. No-op (not an error thrown) when env isn't configured, so
// previews/local without the secret stay safe.
export async function sendCapiEvent(
  event: CapiEvent,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!PIXEL_ID || !TOKEN) return { ok: false, error: "capi_not_configured" };

  const u = event.user;
  const userData: Record<string, unknown> = {};
  const em = sha256(u.email);
  if (em) userData.em = [em];
  const ph = sha256(normalizePhone(u.phone));
  if (ph) userData.ph = [ph];
  const fn = sha256(u.firstName);
  if (fn) userData.fn = [fn];
  const ln = sha256(u.lastName);
  if (ln) userData.ln = [ln];
  const ext = sha256(u.externalId);
  if (ext) userData.external_id = [ext];
  if (u.clientIp) userData.client_ip_address = u.clientIp;
  if (u.userAgent) userData.client_user_agent = u.userAgent;
  if (u.fbc) userData.fbc = u.fbc;
  if (u.fbp) userData.fbp = u.fbp;

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: event.eventName,
        event_time: Math.floor(Date.now() / 1000),
        ...(event.eventId ? { event_id: event.eventId } : {}),
        ...(event.eventSourceUrl ? { event_source_url: event.eventSourceUrl } : {}),
        action_source: event.actionSource ?? "website",
        user_data: userData,
        ...(event.customData ? { custom_data: event.customData } : {}),
      },
    ],
    ...(TEST_CODE ? { test_event_code: TEST_CODE } : {}),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(TOKEN)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[meta-capi] ${event.eventName} failed: ${res.status} ${text}`);
      return { ok: false, status: res.status, error: text };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    console.error(`[meta-capi] ${event.eventName} error:`, e);
    return { ok: false, error: String(e) };
  } finally {
    clearTimeout(timeout);
  }
}

// Split a single "full name" field into first/last for match quality.
export function splitName(full?: string | null): { firstName?: string; lastName?: string } {
  const name = (full ?? "").trim();
  if (!name) return {};
  const parts = name.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
