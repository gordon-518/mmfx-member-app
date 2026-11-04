import type { SupabaseClient } from "@supabase/supabase-js";
import { isLocale, type Locale } from "@/i18n/config";

/**
 * Each member's saved language, for the emails sent to them: one round trip
 * for a whole batch (fn_user_locales, service role only). A member with no
 * saved language gets English, and so does everyone when the lookup fails —
 * a language lookup must never stop an email that would otherwise go out.
 */
export async function emailLocales(db: SupabaseClient, userIds: string[]): Promise<Map<string, Locale>> {
  const out = new Map<string, Locale>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return out;
  const { data, error } = await db.rpc("fn_user_locales", { p_ids: ids });
  if (error) {
    console.error("[email] language lookup failed, sending in English:", error.message);
    return out;
  }
  for (const row of (data ?? []) as { user_id: string; locale: string | null }[]) {
    if (isLocale(row.locale)) out.set(row.user_id, row.locale);
  }
  return out;
}

/** One member's language, English when none is saved. */
export async function emailLocale(db: SupabaseClient, userId: string): Promise<Locale> {
  return (await emailLocales(db, [userId])).get(userId) ?? "en";
}
