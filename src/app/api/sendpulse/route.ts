// Receives a Supabase database webhook on profiles INSERT and adds the new
// signup (email + name) to the SendPulse "MMFX Signups" address book.
//
// Auth: the webhook must send the shared SENDPULSE_WEBHOOK_SECRET header, so
// random callers can't stuff the mailing list. SendPulse creds + book id are
// server-side env (never client). Failures here never block signup — the
// Supabase trigger fires this fire-and-forget via pg_net.

const SP_OAUTH = "https://api.sendpulse.com/oauth/access_token";

async function sendpulseToken(id: string, secret: string): Promise<string | null> {
  const r = await fetch(SP_OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
  });
  const j = await r.json().catch(() => ({}));
  return j?.access_token ?? null;
}

export async function POST(request: Request) {
  const secret = process.env.SENDPULSE_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-webhook-secret") !== secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const record = (payload as { record?: { email?: string; full_name?: string | null } })?.record;
  const email = record?.email?.trim();
  const fullName = record?.full_name?.trim() || "";
  if (!email) {
    return Response.json({ error: "no email in payload" }, { status: 400 });
  }

  const id = process.env.SENDPULSE_API_ID;
  const apiSecret = process.env.SENDPULSE_API_SECRET;
  const book = process.env.SENDPULSE_BOOK_ID;
  if (!id || !apiSecret || !book) {
    return Response.json({ error: "sendpulse not configured" }, { status: 500 });
  }

  const token = await sendpulseToken(id, apiSecret);
  if (!token) {
    return Response.json({ error: "sendpulse auth failed" }, { status: 502 });
  }

  const add = await fetch(`https://api.sendpulse.com/addressbooks/${book}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      emails: [{ email, variables: fullName ? { Name: fullName } : {} }],
    }),
  });
  const addJson = await add.json().catch(() => ({}));
  if (!add.ok || (addJson as { result?: boolean })?.result !== true) {
    return Response.json({ error: "sendpulse add failed", detail: addJson }, { status: 502 });
  }

  return Response.json({ ok: true });
}
