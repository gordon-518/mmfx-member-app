import { NextResponse } from "next/server";
import { getAccess } from "@/lib/access";
import { sendEmail, addContactToBook } from "@/lib/sendpulse";
import { fundamentalEmailHtml } from "@/lib/fundamentalEmail";

// "Send me a copy" from the Fundamental Desk. The desk iframe posts the chosen
// instrument; we email the desk's PDF to the LOGGED-IN account's own address.
// No client-supplied recipient is ever trusted.

const DESK_BASE = "https://api.marketmakersfx.net";
const PDF_TIMEOUT_MS = 15_000;

// The 11 supported instruments → display names. Doubles as the allowlist.
const INSTRUMENTS: Record<string, string> = {
  XAUUSD: "XAU/USD",
  XAGUSD: "XAG/USD",
  EURUSD: "EUR/USD",
  GBPUSD: "GBP/USD",
  USDJPY: "USD/JPY",
  USDCHF: "USD/CHF",
  AUDUSD: "AUD/USD",
  USDCAD: "USD/CAD",
  NZDUSD: "NZD/USD",
  BTCUSD: "BTC/USD",
  ETHUSD: "ETH/USD",
};

export async function POST(req: Request) {
  // Authorize: must be able to view the desk (Full) OR be the admin account.
  const access = await getAccess();
  if (!access.signedIn || !access.profile) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  const authorized = access.tier === "Full" || access.profile.is_admin;
  if (!authorized) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  // Validate instrument against the allowlist (hasOwn avoids prototype keys).
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const instrument = (body as { instrument?: unknown } | null)?.instrument;
  if (
    typeof instrument !== "string" ||
    !Object.prototype.hasOwnProperty.call(INSTRUMENTS, instrument)
  ) {
    return NextResponse.json({ ok: false, reason: "bad_instrument" }, { status: 400 });
  }
  const display = INSTRUMENTS[instrument];

  // Fetch the public desk PDF with a hard timeout.
  let pdfBase64: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PDF_TIMEOUT_MS);
    let pdfRes: Response;
    try {
      pdfRes = await fetch(
        `${DESK_BASE}/api/report.pdf?instrument=${encodeURIComponent(instrument)}`,
        { signal: controller.signal }
      );
    } finally {
      clearTimeout(timer);
    }
    if (!pdfRes.ok) {
      return NextResponse.json({ ok: false, reason: "pdf_unavailable" }, { status: 502 });
    }
    const buf = await pdfRes.arrayBuffer();
    pdfBase64 = Buffer.from(buf).toString("base64");
  } catch {
    return NextResponse.json({ ok: false, reason: "pdf_unavailable" }, { status: 502 });
  }

  // Email it to the session user — recipient comes from the server session only.
  const result = await sendEmail({
    to: {
      name: access.profile.full_name || access.profile.email,
      email: access.profile.email,
    },
    from: { name: "Market Makers FX", email: "hello@marketmakersfx.net" },
    subject: `Your ${display} fundamental thesis`,
    html: fundamentalEmailHtml(display),
    attachments: [
      { name: `${instrument.toLowerCase()}_thesis.pdf`, contentBase64: pdfBase64 },
    ],
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: "send_failed" }, { status: 500 });
  }

  // Email is out — now tag the user in the "FA Bot Users" book so we can filter
  // who used the desk. Fire-and-forget: tagging never affects the email result.
  const book = process.env.SENDPULSE_FA_BOOK_ID;
  if (book) {
    try {
      await addContactToBook(book, access.profile.email, {
        fa_last_used: new Date().toISOString().slice(0, 10), // YYYY-MM-DD (UTC)
        fa_last_instrument: instrument,
      });
    } catch {
      /* best-effort — the email already went out */
    }
  }

  return NextResponse.json({ ok: true });
}
