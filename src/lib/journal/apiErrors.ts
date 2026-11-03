// The journal's API routes answer with English error messages. The dashboard
// and the connect form show them in the reader's language, so each message a
// member can actually hit maps to a key in the dictionary (journal.errors).
// A server error (5xx) shows the action's own fallback instead of whatever the
// database said; anything else unrecognised shows as the API wrote it.

import { fmt, type Vars } from "@/i18n/format";
import type { Messages } from "@/i18n/messages/types";

export type JournalErrorMessages = Messages["journal"]["errors"];
export type JournalApiErrorKey = keyof JournalErrorMessages;

const KNOWN: readonly (readonly [RegExp, JournalApiErrorKey])[] = [
  [/^Not signed in$/i, "notSignedIn"],
  [/^(Full access required|Team MM only|Admins only)$/i, "noAccess"],
  [/^Add your trading account number/i, "noAccountNumber"],
  [/^Choose your broker$/i, "chooseBroker"],
  [/^Investor password is required$/i, "passwordRequired"],
  [/can't be connected\. Please contact support/i, "accountBlocked"],
  [/^This account is already connected$/i, "alreadyConnected"],
  [/^Account not found$/i, "accountNotFound"],
  [/^Account is not connected$/i, "accountNotConnected"],
  [/^A sync is already in progress/i, "syncInProgress"],
  [/^Synced recently/i, "syncedRecently"],
  [/^Trade not found$/i, "tradeNotFound"],
  [/must be a non-negative number$/i, "goalsNumber"],
  [/^Daily limit reached/i, "coachLimit"],
  [/closed trades before the coach/i, "coachNoTrades"],
  [/coach is temporarily unavailable/i, "coachUnavailable"],
];

export function journalApiErrorKey(raw: string): JournalApiErrorKey | null {
  return KNOWN.find(([pattern]) => pattern.test(raw))?.[1] ?? null;
}

/**
 * What to show for a failed journal API call. `body` is the parsed JSON (or
 * anything, if parsing failed); `vars` fills placeholders such as {cap}.
 */
export function journalApiError(
  status: number,
  body: unknown,
  e: JournalErrorMessages,
  fallback: string,
  vars?: Vars
): string {
  const raw =
    body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
      ? (body as { error: string }).error
      : null;
  const key = raw ? journalApiErrorKey(raw) : null;
  if (key) return fmt(e[key], vars);
  if (!raw || status >= 500) return fallback;
  return raw;
}
