// Which bot sends a Telegram message (17 Sep).
//
// Production never had TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID, so both the
// deposit alert and the 9am daily-stats post failed silently for months. The
// alert bot (@MMbrainerbot, ADMIN_ALERT_*) is now set, so everything falls
// back to it rather than going nowhere.
//
// A token and a chat id must come from the SAME pair: a bot can only post to
// chats it belongs to, so mixing one bot's token with another bot's chat fails.
// Kept free of "server-only" so it can be unit-tested.

export interface TelegramCredentials {
  token: string;
  chatId: string;
}

/**
 * The environment to read. A plain string map, so process.env satisfies it.
 * Keys used: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (the stats bot) and
 * ADMIN_ALERT_BOT_TOKEN, ADMIN_ALERT_CHAT_ID (the alert bot, @MMbrainerbot).
 */
export type TelegramEnv = Record<string, string | undefined>;

function pair(token?: string, chatId?: string): TelegramCredentials | null {
  return token && chatId ? { token, chatId } : null;
}

/**
 * `preferAdminBot` is for admin alerts, which should land on the bot Gordon
 * watches even when the stats bot is configured.
 */
export function resolveTelegramCredentials(
  env: TelegramEnv,
  opts: { botToken?: string; chatId?: string; preferAdminBot?: boolean } = {}
): TelegramCredentials | null {
  const explicit = pair(opts.botToken, opts.chatId);
  if (explicit) return explicit;

  const stats = pair(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID);
  const admin = pair(env.ADMIN_ALERT_BOT_TOKEN, env.ADMIN_ALERT_CHAT_ID);

  return opts.preferAdminBot ? (admin ?? stats) : (stats ?? admin);
}
