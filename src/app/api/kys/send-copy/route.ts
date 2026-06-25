import { NextResponse } from "next/server";
import { getAccess } from "@/lib/access";
import { sendEmail, addContactToBook } from "@/lib/sendpulse";

// "Send me a copy" from the Know Your Style bot. KYS posts the user's finished
// result HTML up to us; we email it to the LOGGED-IN account's own address.
// The recipient is resolved from the session — never from the iframe payload.

// Guard against an oversized body (the HTML is built client-side).
const MAX_HTML = 300_000;

export async function POST(req: Request) {
  // Authorize: must be able to view the bot (Full) OR be the admin account.
  const access = await getAccess();
  if (!access.signedIn || !access.profile) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  const authorized = access.tier === "Full" || access.profile.is_admin;
  if (!authorized) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const payload = body as { archetype?: unknown; resultHtml?: unknown } | null;
  const archetypeRaw = payload?.archetype;
  const resultHtml = payload?.resultHtml;
  if (
    typeof archetypeRaw !== "string" ||
    typeof resultHtml !== "string" ||
    !resultHtml.trim() ||
    resultHtml.length > MAX_HTML
  ) {
    return NextResponse.json({ ok: false, reason: "bad_payload" }, { status: 400 });
  }
  // Sanitize the archetype for the subject line (single line, bounded length).
  const archetype = archetypeRaw.replace(/[\r\n]+/g, " ").trim().slice(0, 120) || "Your result";

  // resultHtml is already a complete, email-safe HTML body — send it as-is.
  const result = await sendEmail({
    to: {
      name: access.profile.full_name || access.profile.email,
      email: access.profile.email,
    },
    from: { name: "Market Makers FX", email: "hello@marketmakersfx.net" },
    subject: `Your Know Your Style result — ${archetype}`,
    html: resultHtml,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: "send_failed" }, { status: 500 });
  }

  // Email is out — tag the user in the "KYS Users" book. Fire-and-forget: the
  // tagging never affects the email result.
  const book = process.env.SENDPULSE_KYS_BOOK_ID;
  if (book) {
    try {
      await addContactToBook(book, access.profile.email, {
        kys_last_used: new Date().toISOString().slice(0, 10), // YYYY-MM-DD (UTC)
        kys_archetype: archetype,
      });
    } catch {
      /* best-effort — the email already went out */
    }
  }

  return NextResponse.json({ ok: true });
}
