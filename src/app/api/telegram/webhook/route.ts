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
  const cb = update?.callback_query;
  if (cb?.data) {
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
