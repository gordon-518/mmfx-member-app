import { NextResponse } from "next/server";
import { adminDb } from "@/lib/channel/db";
import { parseTelegramTxt } from "@/lib/channel/analysisPosts";

export const runtime = "nodejs";

const pub = (bucket: string, p: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${p}`;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const { date, txt, macroImageBase64 } = (await req.json().catch(() => ({}))) as {
    date?: string; txt?: string; macroImageBase64?: string;
  };
  if (!date || !txt) return NextResponse.json({ ok: false, reason: "bad_input" }, { status: 400 });

  const { daily, macro } = parseTelegramTxt(txt);

  // Upload the macro chart to channel-assets (service role, storage REST).
  let macroUrl: string | null = null;
  if (macroImageBase64) {
    const up = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/channel-assets/macro-${date}.png`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "image/png",
          "x-upsert": "true",
        },
        body: Buffer.from(macroImageBase64, "base64"),
      }
    );
    if (up.ok) macroUrl = pub("channel-assets", `macro-${date}.png`);
  }

  const now = new Date().toISOString();
  const rows = [
    {
      kind: "analysis_daily", status: "queued", body: daily,
      image_url: pub("analysis-covers", `cover-${date}.png`),
      link_url: "https://app.marketmakersfx.net/daily-analysis",
      dedupe_key: `analysis_daily:${date}`, scheduled_for: now,
    },
    {
      kind: "analysis_macro", status: "queued", body: macro,
      image_url: macroUrl, link_url: null,
      dedupe_key: `analysis_macro:${date}`, scheduled_for: now,
    },
  ];

  const { error } = await adminDb()
    .from("channel_posts")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, enqueued: rows.map((r) => r.dedupe_key) });
}
