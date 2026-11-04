import type { Locale } from "@/i18n/config";
import type { EmailMessages } from "./types";
import { en } from "./en";
import { zhHans } from "./zh-Hans";
import { zhHant } from "./zh-Hant";
import { ms } from "./ms";
import { id } from "./id";

export type { EmailMessages } from "./types";

// Every locale fills the whole EmailMessages shape — a missing line is a type
// error, not an English sentence in the middle of a Malay email.
export const EMAIL_MESSAGES: Record<Locale, EmailMessages> = {
  en,
  "zh-Hans": zhHans,
  "zh-Hant": zhHant,
  ms,
  id,
};

/** The words for one reader. English when the locale is missing. */
export function emailMessages(locale: Locale = "en"): EmailMessages {
  return EMAIL_MESSAGES[locale] ?? en;
}

/**
 * A risk line as the reader sees it: the English wording, which is the one
 * that governs, then the reader's own language under it — the same rule the
 * app's ComplianceText follows.
 */
export function riskLines(locale: Locale, pick: (m: EmailMessages) => string): string[] {
  const english = pick(en);
  return locale === "en" ? [english] : [english, pick(emailMessages(locale))];
}
