"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "./config";

/**
 * Switch language. The cookie makes this device change at once; for a
 * signed-in member it is also written to user_metadata, which the proxy copies
 * back into the cookie on their other devices. Signed-out readers (login,
 * signup) just get the cookie.
 */
export async function setLocale(locale: string): Promise<{ ok: boolean }> {
  if (!isLocale(locale)) return { ok: false };
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user && data.user.user_metadata?.locale !== locale) {
      await supabase.auth.updateUser({ data: { locale } });
    }
  } catch {
    // The cookie is already set; the cross-device copy is best-effort.
  }
  return { ok: true };
}
