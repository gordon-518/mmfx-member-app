import "server-only";
import { resolveTelegramCredentials } from "@/lib/telegramCredentials";

// One path for sending a Telegram DM via the Bot API. Best-effort: every
// failure resolves to { ok:false } rather than throwing, so callers (e.g. the
// daily-stats cron) never break their critical path on a messaging hiccup.
//
// The bot is chosen by resolveTelegramCredentials: TELEGRAM_* first, then the
// alert bot ADMIN_ALERT_* (so the 9am stats post works even though production
// never had TELEGRAM_*). Server-only — the bot token must never reach a browser.

export interface TelegramResult {
  ok: boolean;
  detail: unknown;
}

export interface SendTelegramOptions {
  /** Send as a different bot (defaults to TELEGRAM_BOT_TOKEN). */
  botToken?: string;
  /** Send to a different chat (defaults to TELEGRAM_CHAT_ID). */
  chatId?: string;
  /** Admin alerts: prefer the alert bot (@MMbrainerbot) over the stats bot. */
  preferAdminBot?: boolean;
  /** "HTML" (default) or "MarkdownV2". HTML is the most forgiving to build. */
  parseMode?: "HTML" | "MarkdownV2";
  /** Suppress the link preview card. Defaults to true. */
  disablePreview?: boolean;
}

export async function sendTelegram(
  text: string,
  opts: SendTelegramOptions = {}
): Promise<TelegramResult> {
  const creds = resolveTelegramCredentials(process.env, {
    botToken: opts.botToken,
    chatId: opts.chatId,
    preferAdminBot: opts.preferAdminBot,
  });
  if (!creds) {
    return { ok: false, detail: "no Telegram bot configured (TELEGRAM_* or ADMIN_ALERT_*)" };
  }
  const { token, chatId } = creds;

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
  return sendTelegram(text, { ...opts, preferAdminBot: true });
}

/** Escape the five characters that are special inside Telegram HTML text. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
