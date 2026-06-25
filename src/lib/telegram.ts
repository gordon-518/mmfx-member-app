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
  /** "HTML" (default) or "MarkdownV2". HTML is the most forgiving to build. */
  parseMode?: "HTML" | "MarkdownV2";
  /** Suppress the link preview card. Defaults to true. */
  disablePreview?: boolean;
}

export async function sendTelegram(
  text: string,
  opts: SendTelegramOptions = {}
): Promise<TelegramResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
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

/** Escape the five characters that are special inside Telegram HTML text. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
