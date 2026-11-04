import { NextResponse } from "next/server";
import { deskAuthorized } from "@/lib/fa/guard";
import { getDeskAnalysis } from "@/lib/fa/desk";
import { deskInstrument } from "@/lib/fa/types";
import { assetName } from "@/lib/fa/glossary/match";
import { generatePlain, PlainSchema, type Plain } from "@/lib/fa/plain";
import { adminDb } from "@/lib/channel/db";
import { getLocale, messagesFor } from "@/i18n/server";

// "In plain words" for one thesis, in the member's language. The first member
// to open a thesis in a language waits for Claude to write it (~10–30s); it is
// saved per (instrument, generated_at, locale) and everyone after reads the
// saved copy. A new thesis has a new generated_at, so it gets a fresh version.

export const maxDuration = 60;

export async function GET(req: Request) {
  if (!(await deskAuthorized())) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  // The desk answers with gold for an unknown id, so only registry ids pass.
  const instrument = deskInstrument(new URL(req.url).searchParams.get("instrument"));
  if (!instrument) {
    return NextResponse.json({ ok: false, reason: "bad_instrument" }, { status: 400 });
  }

  const envelope = await getDeskAnalysis(instrument.id);
  if (!envelope) {
    return NextResponse.json({ ok: false, reason: "desk_unavailable" }, { status: 502 });
  }

  const locale = await getLocale();
  const generatedAt = envelope.analysis.generated_at;
  const db = adminDb();
  const key = { instrument: instrument.id, generated_at: generatedAt, locale };

  const { data: saved, error: readError } = await db
    .from("fa_plain_summaries")
    .select("body")
    .match(key)
    .maybeSingle();
  if (readError) console.error("[fa-plain] cache read failed", readError.message);
  const cached = PlainSchema.safeParse(saved?.body);
  if (cached.success) return ok(cached.data, generatedAt);

  const nicknames: Record<string, string> = messagesFor(locale).fundamental.nicknames;
  const out = await generatePlain({
    analysis: envelope.analysis,
    instrument,
    assetName: assetName(instrument, nicknames[instrument.id] ?? instrument.display),
    locale,
  });
  if (!out.plain) {
    console.error("[fa-plain] generation failed", instrument.id, locale, out.error);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 503 });
  }

  // Two members opening the same new thesis at once both generate; the first
  // write wins and the second is a no-op.
  const { error: writeError } = await db
    .from("fa_plain_summaries")
    .upsert(
      { ...key, body: out.plain, model: out.model },
      { onConflict: "instrument,generated_at,locale", ignoreDuplicates: true }
    );
  if (writeError) console.error("[fa-plain] cache write failed", writeError.message);

  return ok(out.plain, generatedAt);
}

function ok(plain: Plain, generatedAt: string) {
  return NextResponse.json({ ok: true, plain, generatedAt }, { headers: { "Cache-Control": "private, no-store" } });
}
