import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { accessTierFor, type TierSnapshot } from "@/lib/tiers";
import type { MemberContext } from "./types";

const REF_RE = /\bMM-([0-9a-f]{6})\b/gi;

/** The hex of the most recent MM-XXXXXX reference in the texts, uppercased. */
export function refFromTexts(texts: string[]): string | null {
  for (let i = texts.length - 1; i >= 0; i--) {
    const all = [...texts[i].matchAll(REF_RE)];
    if (all.length) return all[all.length - 1][1].toUpperCase();
  }
  return null;
}

async function userByRef(db: SupabaseClient, hex: string): Promise<string | null> {
  const { data } = await db.rpc("fn_support_member_by_ref", { p_hex: hex });
  return typeof data === "string" ? data : null;
}

async function userByHandle(db: SupabaseClient, handle: string): Promise<string | null> {
  // `_` and `%` are wildcards in ilike, and Telegram usernames commonly contain
  // `_` — an unescaped handle could match a DIFFERENT member (e.g. "Sam_T" would
  // also match "SamXT") and leak their deposit status. Escape both before matching.
  const escaped = handle.replace(/^@+/, "").replace(/[\\%_]/g, "\\$&");
  const { data } = await db.from("deposit_submissions").select("user_id").ilike("telegram_username", escaped);
  const ids = [...new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id))];
  return ids.length === 1 ? ids[0] : null;
}

export async function findMember(
  db: SupabaseClient,
  opts: { texts: string[]; telegramUsername: string | null }
): Promise<MemberContext | null> {
  let userId: string | null = null;
  let matchedBy: MemberContext["matchedBy"] = "ref";
  const hex = refFromTexts(opts.texts);
  if (hex) userId = await userByRef(db, hex);
  if (!userId && opts.telegramUsername) { userId = await userByHandle(db, opts.telegramUsername); matchedBy = "handle"; }
  if (!userId) return null;

  const { data: p } = await db.from("profiles")
    .select("account_status, trial_ends_at, deposit_amount, grandfathered, lifetime_plan")
    .eq("id", userId).maybeSingle();
  if (!p) return null;
  const { data: s } = await db.from("deposit_submissions")
    .select("status, reject_reason, created_at").eq("user_id", userId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  return {
    userId,
    matchedBy,
    tier: accessTierFor(p as TierSnapshot),
    trialEndsAt: (p as TierSnapshot).trial_ends_at ? String((p as TierSnapshot).trial_ends_at) : null,
    submission: s ? { status: s.status, rejectReason: s.reject_reason ?? null, createdAt: s.created_at } : null,
  };
}
