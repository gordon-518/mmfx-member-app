import { NextResponse } from "next/server";
import { getAccess } from "@/lib/access";
import { canAccess } from "@/lib/access/features";
import { sendEmail, addContactToBook } from "@/lib/sendpulse";
import { createClient } from "@/lib/supabase/server";
import { getArchetype, toArchetypeId } from "@/lib/kys/archetypes";
import { getT } from "@/i18n/server";
import { fmt } from "@/i18n/format";

// "Send me a copy" from the Know Your Style bot. KYS posts the user's finished
// result HTML up to us; we email it to the LOGGED-IN account's own address.
// The recipient is resolved from the session — never from the iframe payload.
//
// The archetype arrives as its ID (Nov 2026). It used to be the display name,
// which this route then wrote over profiles.kys_archetype — so a member who
// emailed themselves a copy lost the ID everything else reads. The English
// display name is still accepted, for a page open from before the change.

// Guard against an oversized body (the HTML is built client-side).
const MAX_HTML = 300_000;

export async function POST(req: Request) {
  // Authorize: must be able to open the bot (the feature map) OR be the admin.
  const access = await getAccess();
  if (!access.signedIn || !access.profile) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  const authorized =
    canAccess("know-your-style", { tier: access.memberTier, isAdmin: access.profile.is_admin }) ||
    access.profile.is_admin;
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
  const archetypeId = typeof archetypeRaw === "string" ? toArchetypeId(archetypeRaw) : null;
  if (
    !archetypeId ||
    typeof resultHtml !== "string" ||
    !resultHtml.trim() ||
    resultHtml.length > MAX_HTML
  ) {
    return NextResponse.json({ ok: false, reason: "bad_payload" }, { status: 400 });
  }
  // The subject names the archetype in the reader's language; SendPulse keeps
  // the English name it has always been sent, so existing segments still match.
  const t = await getT();
  const englishName = getArchetype(archetypeId)?.name ?? archetypeId;

  // resultHtml is already a complete, email-safe HTML body — send it as-is.
  const result = await sendEmail({
    to: {
      name: access.profile.full_name || access.profile.email,
      email: access.profile.email,
    },
    from: { name: "Market Makers FX", email: "hello@marketmakersfx.net" },
    subject: fmt(t.kys.emailSubject, { archetype: t.archetypes[archetypeId].name }),
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
        kys_archetype: englishName,
      });
    } catch {
      /* best-effort — the email already went out */
    }
  }

  // Record completion on the user's profile (drives the dashboard onboarding
  // hero). Best-effort — never affects the email result.
  try {
    const supabase = await createClient();
    await supabase.rpc("fn_mark_kys_completed", { p_archetype: archetypeId });
  } catch {
    /* best-effort — the email already went out */
  }

  return NextResponse.json({ ok: true });
}
