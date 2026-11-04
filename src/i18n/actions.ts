"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isDemoUser } from "@/lib/showcase";
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "./config";

/**
 * Switch language. The cookie makes this device change at once; for a
 * signed-in member it is also written to user_metadata, which the proxy copies
 * back into the cookie on their other devices. Signed-out readers (login,
 * signup) just get the cookie.
 *
 * For a signed-in member the account copy is written first: if that fails,
 * the cookie isn't set either (the proxy would only put the old language back
 * on the next request). The shared showcase account never stores a choice, so
 * one viewer's language can't become everyone's.
 */
export async function setLocale(locale: string): Promise<{ ok: boolean }> {
  if (!isLocale(locale)) return { ok: false };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (user && !isDemoUser(user.email) && user.user_metadata?.locale !== locale) {
    const { error } = await supabase.auth.updateUser({ data: { locale } });
    if (error) {
      console.error("[i18n] saving the language to the account failed:", error.message);
      return { ok: false };
    }
  }
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  return { ok: true };
}
