import { NextResponse } from "next/server";
import { adminDb } from "@/lib/channel/db";
import { draftLibraryPosts } from "@/lib/channel/draft";
import { lintPost } from "@/lib/channel/compliance";
import { sendApproverDM } from "@/lib/channel/sender";
import { houseMarkdownToHtml } from "@/lib/channel/markdown";
import type { LibraryItem, LibraryEngagement } from "@/lib/channel/types";

export const runtime = "nodejs";

const POOL_MIN = 12;                 // below this, top the pool back up
const DRAFTS_PER_TOPUP = 8;
const LEARN_BATCH = 3;               // steady trickle of evidence-led copy
const DRAFT_BACKLOG_MAX = 6;         // don't flood the approver with drafts
const RETIRE_MIN_IMPRESSIONS = 6;    // enough data to judge a post
const RETIRE_RATE_FLOOR = 0.05;      // engagement/impression below this = retire
const EXAMPLE_MIN_IMPRESSIONS = 4;   // a "winner" must have actually run
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

  // 2. Pick the winners that will seed new copy. A post must have actually run
  //    a few times to qualify — otherwise a single lucky click on a brand-new
  //    post would crown it best and the loop would amplify noise.
  const proven = approved
    .filter((it) => !retired.includes(it.id))
    .filter((it) => (engById[it.id]?.impressions ?? 0) >= EXAMPLE_MIN_IMPRESSIONS)
    .sort((a, b) => rate(engById[b.id]) - rate(engById[a.id]));

  const winners = proven.slice(0, 3).map((it) => {
    const e = engById[it.id];
    return {
      body: it.body,
      feature: it.button_set?.[0]?.slug ?? "the desk",
      impressions: e.impressions,
      clicks: e.clicks,
      reactions: e.reactions,
    };
  });

  // 3. Decide whether to draft. Two independent triggers:
  //    - the pool ran low (top it up), or
  //    - we have fresh proof of what works (learn from it).
  //    The second is what makes this a loop; without it the route only ever
  //    fired in a scarcity that a healthy pool never reaches.
  const remaining = approved.length - retired.length;
  const { count: backlog } = await db
    .from("content_library")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft");

  const poolLow = remaining < POOL_MIN;
  const canLearn = winners.length > 0 && (backlog ?? 0) < DRAFT_BACKLOG_MAX;

  if (!poolLow && !canLearn) {
    return NextResponse.json({
      ok: true, drafted: 0, retired: retired.length,
      reason: (backlog ?? 0) >= DRAFT_BACKLOG_MAX ? "backlog_full" : "no_proven_winners",
    });
  }

  const wanted = poolLow ? DRAFTS_PER_TOPUP : LEARN_BATCH;
  const drafts = await draftLibraryPosts(wanted, winners);
  const clean = drafts.filter((d) => lintPost(d.body).ok);
  if (clean.length === 0) {
    return NextResponse.json({ ok: true, drafted: 0, retired: retired.length, reason: "none_clean" });
  }

  // Inherit targeting from the winner that seeded it. New copy written in the
  // spirit of a flagship post should point at that feature and carry its
  // advertising weight — otherwise learned copy defaults to weight 1 and a
  // generic signup button, and the best insight gets the least airtime.
  const seedFor = (i: number) => proven[i % Math.max(proven.length, 1)];
  const { data: inserted } = await db
    .from("content_library")
    .insert(clean.map((d, i) => {
      const seed = winners.length ? seedFor(i) : null;
      return {
        kind: d.kind,
        body: d.body,
        status: "draft",
        source: "claude",
        button_set: seed?.button_set ?? DEFAULT_BUTTONS[d.kind],
        weight: seed?.weight ?? 2,
      };
    }))
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
