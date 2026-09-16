import "server-only";

// One path for sending a Telegram DM via the Bot API. Best-effort: every
// failure resolves to { ok:false } rather than throwing, so callers (e.g. the
// daily-stats cron) never break their critical path on a messaging hiccup.
//
// Reads TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID. Server-only — the bot token must
// never reach a browser.

export interface TelegramResult {
  ok: boolean;
  detail: unknown;
}

export interface SendTelegramOptions {
  /** Send as a different bot (defaults to TELEGRAM_BOT_TOKEN). */
  botToken?: string;
  /** Send to a different chat (defaults to TELEGRAM_CHAT_ID). */
  chatId?: string;
  /** "HTML" (default) or "MarkdownV2". HTML is the most forgiving to build. */
  parseMode?: "HTML" | "MarkdownV2";
  /** Suppress the link preview card. Defaults to true. */
  disablePreview?: boolean;
}

export async function sendTelegram(
  text: string,
  opts: SendTelegramOptions = {}
): Promise<TelegramResult> {
  const token = opts.botToken || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = opts.chatId || process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { ok: false, detail: "TELEGRAM_BOT_TOKEN/CHAT_ID not configured" };
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: opts.parseMode ?? "HTML",
        disable_web_page_preview: opts.disablePreview ?? true,
      }),
    });
    const detail = await r.json().catch(() => null);
    return { ok: r.ok && (detail?.ok ?? false), detail };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

// Admin alerts go to their own bot (Gordon, 17 Sep): @MMbrainerbot runs on the
// VPS, so alerts land somewhere he watches. ADMIN_ALERT_BOT_TOKEN and
// ADMIN_ALERT_CHAT_ID override the stats bot; without them this falls back to
// TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID, so nothing breaks until they are set.
export async function sendAdminTelegram(
  text: string,
  opts: SendTelegramOptions = {}
): Promise<TelegramResult> {
  return sendTelegram(text, {
    ...opts,
    botToken: process.env.ADMIN_ALERT_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.ADMIN_ALERT_CHAT_ID || process.env.TELEGRAM_CHAT_ID,
  });
}

/** Escape the five characters that are special inside Telegram HTML text. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
