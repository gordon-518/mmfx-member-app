import { NextResponse } from "next/server";
import { adminDb } from "@/lib/channel/db";
import { houseMarkdownToHtml } from "@/lib/channel/markdown";
import { sendChannelText, sendChannelPhoto } from "@/lib/channel/sender";
import type { ChannelPostRow } from "@/lib/channel/types";

export const runtime = "nodejs";

const MAX_ATTEMPTS = 3;
const CAPTION_LIMIT = 1024;

// Build a Telegram inline keyboard from the post's button set. Each button is a
// URL button pointing at the /go redirect with this post's id, so clicks are
// attributed back to the post (and library item) that earned them.
function buildButtons(row: ChannelPostRow): unknown | undefined {
  if (!row.button_set || row.button_set.length === 0) return undefined;
  const base = process.env.APP_URL || "https://app.marketmakersfx.net";
  return row.button_set.map((b) => [{ text: b.text, url: `${base}/go/${b.slug}?p=${row.id}` }]);
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const db = adminDb();
  const { data: rows } = await db
    .from("channel_posts")
    .select("*")
    .eq("status", "queued")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(5);

  const results: { id: string; ok: boolean }[] = [];

  for (const row of (rows ?? []) as ChannelPostRow[]) {
    // Claim the row: queued → posting, guarded on status so an overlapping run
    // can't grab the same row. Empty result = someone else already took it.
    const { data: claimed } = await db
      .from("channel_posts")
      .update({ status: "posting", updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "queued")
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    let html = houseMarkdownToHtml(row.body);
    if (row.link_url) html += `\n\n<a href="${row.link_url}">Full breakdown in the app →</a>`;
    const buttons = buildButtons(row);

    let send;
    if (row.image_url) {
      if (html.length <= CAPTION_LIMIT) {
        send = await sendChannelPhoto(row.image_url, html, { buttons });
      } else {
        // Caption too long for one photo message: post the image, then the full
        // text as a reply. Retry-safety: only the photo re-queues on failure. If
        // the photo posts but the text remainder fails, we still mark the row
        // posted (never re-queue) so a retry can't duplicate the photo — the
        // remainder failure is recorded in detail instead.
        const photo = await sendChannelPhoto(row.image_url, "", { buttons });
        if (!photo.ok) {
          send = photo;
        } else {
          const text = await sendChannelText(html, { replyTo: photo.messageId });
          send = {
            ok: true,
            messageId: photo.messageId,
            detail: text.ok ? "ok" : { textRemainderFailed: text.detail },
          };
        }
      }
    } else {
      send = await sendChannelText(html, { buttons });
    }

    if (send.ok) {
      await db.from("channel_posts").update({
        status: "posted",
        telegram_message_id: send.messageId ?? null,
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      results.push({ id: row.id, ok: true });
    } else {
      const attempts = row.attempts + 1;
      await db.from("channel_posts").update({
        status: attempts >= MAX_ATTEMPTS ? "failed" : "queued",
        attempts,
        error: String(send.detail).slice(0, 500),
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      results.push({ id: row.id, ok: false });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
