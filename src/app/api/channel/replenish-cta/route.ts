import { NextResponse } from "next/server";
import { adminDb } from "@/lib/channel/db";
import { draftLibraryPosts } from "@/lib/channel/draft";
import { lintPost } from "@/lib/channel/compliance";
import { sendApproverDM } from "@/lib/channel/sender";
import { houseMarkdownToHtml } from "@/lib/channel/markdown";
import type { LibraryItem, LibraryEngagement } from "@/lib/channel/types";

export const runtime = "nodejs";

const POOL_MIN = 12;
const DRAFTS_PER_TOPUP = 8;
const RETIRE_MIN_IMPRESSIONS = 6;   // enough data to judge a post
const RETIRE_RATE_FLOOR = 0.05;     // engagement/impression below this = retire
const DEFAULT_BUTTONS: Record<string, { text: string; slug: string }[]> = {
  cta: [{ text: "Start your free trial →", slug: "signup" }],
  educational: [{ text: "Today's gold read →", slug: "daily-analysis" }],
};

function rate(e: LibraryEngagement): number {
  return (e.clicks + e.reactions) / Math.max(e.impressions, 1);
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CHANNEL_CRON_SECRET || auth !== `Bearer ${process.env.CHANNEL_CRON_SECRET}`) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const db = adminDb();
  const { data: items } = await db.from("content_library").select("*").eq("status", "approved");
  const { data: eng } = await db.from("library_engagement").select("*");

  const engById: Record<string, LibraryEngagement> = {};
  for (const e of (eng ?? []) as LibraryEngagement[]) engById[e.item_id] = e;

  const approved = (items ?? []) as LibraryItem[];

  // 1. Auto-retire proven low performers.
  const retired: string[] = [];
  for (const it of approved) {
    const e = engById[it.id];
    if (e && e.impressions >= RETIRE_MIN_IMPRESSIONS && rate(e) < RETIRE_RATE_FLOOR) {
      await db.from("content_library")
        .update({ status: "retired", updated_at: new Date().toISOString() })
        .eq("id", it.id);
      retired.push(it.id);
    }
  }

  const remaining = approved.length - retired.length;
  if (remaining >= POOL_MIN) {
    return NextResponse.json({ ok: true, drafted: 0, retired: retired.length, reason: "pool_ok" });
  }

  // 2. Seed new copy from current top performers (self-optimizing loop).
  const examples = approved
    .filter((it) => engById[it.id])
    .sort((a, b) => rate(engById[b.id]) - rate(engById[a.id]))
    .slice(0, 3)
    .map((it) => it.body);

  const drafts = await draftLibraryPosts(DRAFTS_PER_TOPUP, examples);
  const clean = drafts.filter((d) => lintPost(d.body).ok);
  if (clean.length === 0) {
    return NextResponse.json({ ok: true, drafted: 0, retired: retired.length, reason: "none_clean" });
  }

  const { data: inserted } = await db
    .from("content_library")
    .insert(clean.map((d) => ({
      kind: d.kind, body: d.body, status: "draft", source: "claude",
      button_set: DEFAULT_BUTTONS[d.kind],
    })))
    .select("id, kind, body");

  // 3. One-tap brand-safety approval for each new draft.
  for (const item of (inserted ?? []) as { id: string; kind: string; body: string }[]) {
    await sendApproverDM(
      `<b>New ${item.kind} draft — approve for the channel?</b>\n\n${houseMarkdownToHtml(item.body)}`,
      [[
        { text: "✅ Approve", callback_data: `approve:${item.id}` },
        { text: "⏭ Skip", callback_data: `skip:${item.id}` },
      ]]
    );
  }

  return NextResponse.json({ ok: true, drafted: (inserted ?? []).length, retired: retired.length });
}
