import { NextResponse } from "next/server";
import { adminDb } from "@/lib/channel/db";
import { pickNext } from "@/lib/channel/rotation";
import type { LibraryItem, LibraryEngagement } from "@/lib/channel/types";

export const runtime = "nodejs";

const AVOID_LAST_N = 4;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const db = adminDb();
  const { data: items } = await db.from("content_library").select("*").eq("status", "approved");
  const { data: eng } = await db.from("library_engagement").select("*");

  // Engagement score = (clicks + reactions) per impression.
  const scoreById: Record<string, number> = {};
  for (const e of (eng ?? []) as LibraryEngagement[]) {
    scoreById[e.item_id] = (e.clicks + e.reactions) / Math.max(e.impressions, 1);
  }

  const pick = pickNext((items ?? []) as LibraryItem[], AVOID_LAST_N, scoreById);
  if (!pick) return NextResponse.json({ ok: true, posted: false, reason: "empty_pool" });

  const now = new Date().toISOString();
  const slot = now.slice(0, 13); // yyyy-mm-ddThh → one post per item per hour-slot max
  await db.from("channel_posts").insert({
    kind: "library", status: "queued", body: pick.body, button_set: pick.button_set,
    scheduled_for: now, dedupe_key: `library:${pick.id}:${slot}`, source_id: pick.id,
  });
  await db.from("content_library")
    .update({ last_posted_at: now, times_posted: pick.times_posted + 1, updated_at: now })
    .eq("id", pick.id);

  return NextResponse.json({ ok: true, posted: true, item: pick.id });
}
