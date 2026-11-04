import "server-only";
import { cookies, headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { negotiateLocale } from "./negotiate";
import { MESSAGES } from "./messages";
import type { Messages } from "./messages/types";

/**
 * The reader's language: their saved choice (cookie, which the proxy keeps in
 * step with user_metadata for signed-in members), else what their browser
 * asks for, else English.
 */
export async function getLocale(): Promise<Locale> {
  try {
    const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (isLocale(saved)) return saved;
    return negotiateLocale((await headers()).get("accept-language"));
  } catch (err) {
    // Next's own signals (a route marked dynamic, a prerender bail-out) must
    // pass through, or a static render would silently bake in English.
    unstable_rethrow(err);
    // Outside a request (a script, an email builder): English.
    return DEFAULT_LOCALE;
  }
}

/** The dictionary for this request. `const t = await getT(); t.nav.dashboard` */
export async function getT(): Promise<Messages> {
  return MESSAGES[await getLocale()];
}

/** For code that already knows the locale (emails, the chat agent). */
export function messagesFor(locale: Locale): Messages {
  return MESSAGES[locale];
}
