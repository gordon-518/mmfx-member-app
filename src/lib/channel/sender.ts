import "server-only";

export interface SendResult { ok: boolean; messageId?: number; detail: unknown; }

async function call(method: string, payload: Record<string, unknown>): Promise<SendResult> {
  const token = process.env.CHANNEL_BOT_TOKEN;
  if (!token) return { ok: false, detail: "CHANNEL_BOT_TOKEN unset" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => null);
    return {
      ok: r.ok && (data?.ok ?? false),
      messageId: data?.result?.message_id,
      detail: data,
    };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

export function sendChannelText(html: string, opts: { replyTo?: number } = {}): Promise<SendResult> {
  return call("sendMessage", {
    chat_id: process.env.CHANNEL_CHAT_ID,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: false,
    ...(opts.replyTo ? { reply_to_message_id: opts.replyTo } : {}),
  });
}

export function sendChannelPhoto(photoUrl: string, htmlCaption: string): Promise<SendResult> {
  return call("sendPhoto", {
    chat_id: process.env.CHANNEL_CHAT_ID,
    photo: photoUrl,
    caption: htmlCaption,
    parse_mode: "HTML",
  });
}

export function editChannelCaption(messageId: number, html: string): Promise<SendResult> {
  return call("editMessageCaption", {
    chat_id: process.env.CHANNEL_CHAT_ID,
    message_id: messageId,
    caption: html,
    parse_mode: "HTML",
  });
}

export function sendApproverDM(html: string, inlineKeyboard: unknown): Promise<SendResult> {
  return call("sendMessage", {
    chat_id: process.env.APPROVER_CHAT_ID,
    text: html,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: inlineKeyboard },
  });
}
