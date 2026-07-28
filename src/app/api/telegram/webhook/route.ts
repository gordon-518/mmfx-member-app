import { NextResponse } from "next/server";
import { adminDb } from "@/lib/channel/db";

export const runtime = "nodejs";

// Receives Telegram updates. Phase 0/1: only approval button taps for library
// drafts (callback_data = "approve:<id>" | "skip:<id>"). Structured so Phase 2
// commands (e.g. /signal) and reaction-count capture slot in later.
export async function POST(req: Request) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = await req.json().catch(() => null);

  // Aggregate reaction counts on a channel post (👍🔥…). Telegram sends these as
  // message_reaction_count updates for channels (anonymous reactions).
  const rc = update?.message_reaction_count;
  if (rc?.message_id) {
    const total = Array.isArray(rc.reactions)
      ? rc.reactions.reduce((sum: number, r: { total_count?: number }) => sum + (r.total_count ?? 0), 0)
      : 0;
    await adminDb()
      .from("channel_posts")
      .update({ reactions: total, updated_at: new Date().toISOString() })
      .eq("telegram_message_id", rc.message_id);
  }

  const cb = update?.callback_query;
  // Only the configured approver may approve/skip drafts — the secret-token
  // header proves the request is from Telegram, not who tapped the button.
  const fromApprover = String(cb?.from?.id) === process.env.APPROVER_CHAT_ID;
  if (cb?.data && fromApprover) {
    const [action, id] = String(cb.data).split(":");
    if ((action === "approve" || action === "skip") && id) {
      await adminDb()
        .from("content_library")
        .update({ status: action === "approve" ? "approved" : "retired", updated_at: new Date().toISOString() })
        .eq("id", id);

      // Stop the button spinner (best-effort).
      await fetch(`https://api.telegram.org/bot${process.env.CHANNEL_BOT_TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cb.id, text: action === "approve" ? "Approved ✅" : "Skipped" }),
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
