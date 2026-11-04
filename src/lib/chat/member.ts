import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { memberContextFor } from "@/lib/support/member";
import type { Locale } from "@/i18n/config";
import type { ChatMember } from "./types";

/** The signed-in member as the assistant may see them. The session is the
 *  identity, so the lookup is by user id and counts as attested. */
export async function loadChatMember(db: SupabaseClient, userId: string, locale: Locale): Promise<ChatMember | null> {
  const ctx = await memberContextFor(db, userId, "session", true);
  if (!ctx) return null;
  return {
    userId,
    email: ctx.email ?? null,
    tier: ctx.tier,
    trialEndsAt: ctx.trialEndsAt,
    depositTotal: ctx.depositTotal ?? 0,
    submission: ctx.submission ? { status: ctx.submission.status, amount: ctx.submission.amount ?? null } : null,
    locale,
  };
}
