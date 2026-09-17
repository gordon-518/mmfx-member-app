import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { accessTierFor, type TierSnapshot } from "@/lib/tiers";
import type { MemberContext } from "./types";

// Reads throw on failure (same contract as sendpulse.ts): a pooler timeout
// or an RLS denial must never be mistaken for "no such member" or "no
// submission" — the orchestrator hands off to a human when a read throws.

const REF_RE = /\bMM-([0-9a-f]{6})\b/gi;

/**
 * The MM-XXXXXX reference code found in the texts, uppercased — but only if
 * every text that contains a match agrees on exactly one distinct code.
 * Two or more DISTINCT codes across the thread (forwarded message, pasted
 * screenshot, someone else's code) is ambiguous: return null rather than
 * guess which one is real. The same code repeated (including a member
 * correcting a typo to a code that still matches an earlier one) still
 * resolves.
 */
export function refFromTexts(texts: string[]): string | null {
  const codes = new Set<string>();
  for (const text of texts) {
    for (const m of text.matchAll(REF_RE)) codes.add(m[1].toUpperCase());
  }
  return codes.size === 1 ? [...codes][0] : null;
}

async function userByRef(db: SupabaseClient, hex: string): Promise<string | null> {
  const { data, error } = await db.rpc("fn_support_member_by_ref", { p_hex: hex });
  if (error) throw new Error("member lookup by ref failed");
  return typeof data === "string" ? data : null;
}

async function userByHandle(db: SupabaseClient, handle: string): Promise<string | null> {
  // `_` and `%` are wildcards in ilike, and `contact.username` is unvalidated
  // external input from the SendPulse API — Telegram usernames commonly
  // contain `_`. An unescaped handle could match a DIFFERENT member (e.g.
  // "Sam_T" would also match "SamXT") and leak their deposit status. `*` is
  // not a wildcard here — PostgREST translates a literal `*` to `%` in
  // like/ilike values BEFORE this escaping ever runs, across the whole
  // pattern with no awareness of the backslash, so escaping it is inert: it
  // can only ever turn the pattern into something that matches zero rows,
  // never widen the match. Escaped anyway, for cheap and harmless defense.
  const escaped = handle.replace(/^@+/, "").replace(/[\\%_*]/g, "\\$&");
  const { data, error } = await db.from("deposit_submissions").select("user_id").ilike("telegram_username", escaped);
  if (error) throw new Error("member lookup by handle failed");
  const ids = [...new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id))];
  return ids.length === 1 ? ids[0] : null;
}

type SubmissionStatus = "pending" | "verified" | "rejected";

interface SubmissionRow {
  status: unknown;
  reject_reason: string | null;
  created_at: string;
}

function toSubmissionStatus(v: unknown): SubmissionStatus {
  if (v === "pending" || v === "verified" || v === "rejected") return v;
  throw new Error("member submission status invalid");
}

export async function findMember(
  db: SupabaseClient,
  opts: { texts: string[]; telegramUsername: string | null }
): Promise<MemberContext | null> {
  const hex = refFromTexts(opts.texts);
  // Resolve both signals when both are present. The ref is self-asserted
  // text (forwardable, pasteable); the handle is platform-attested — it IS
  // the account in this conversation. Neither should silently override the
  // other, so when both resolve and disagree we refuse the match entirely
  // rather than trust whichever happened to be checked first: a wrong guess
  // here means confirming one member's deposit to a different member.
  const byRef = hex ? await userByRef(db, hex) : null;
  const byHandle = opts.telegramUsername ? await userByHandle(db, opts.telegramUsername) : null;
  if (byRef && byHandle && byRef !== byHandle) return null;
  const userId = byRef ?? byHandle;
  // The handle is platform-attested (it IS the account in this
  // conversation) and the stronger signal, so it wins whenever it
  // resolves — even when the ref agrees with it. "ref" is reserved for a
  // ref-only match, where there's no handle resolution to prefer.
  const matchedBy: MemberContext["matchedBy"] = byHandle ? "handle" : "ref";
  if (!userId) return null;

  const { data: p, error: pErr } = await db.from("profiles")
    .select("account_status, trial_ends_at, deposit_amount, grandfathered, lifetime_plan")
    .eq("id", userId).maybeSingle();
  if (pErr) throw new Error("member profile lookup failed");
  if (!p) return null;
  const { data: sData, error: sErr } = await db.from("deposit_submissions")
    .select("status, reject_reason, created_at").eq("user_id", userId)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
  if (sErr) throw new Error("member submission lookup failed");
  const s = sData as SubmissionRow | null;

  return {
    userId,
    matchedBy,
    tier: accessTierFor(p as TierSnapshot),
    trialEndsAt: (p as TierSnapshot).trial_ends_at ? String((p as TierSnapshot).trial_ends_at) : null,
    submission: s ? { status: toSubmissionStatus(s.status), rejectReason: s.reject_reason ?? null, createdAt: s.created_at } : null,
    // Attested only when the platform-attested Telegram username itself
    // resolved to this member — a self-asserted ref code, even one that
    // agrees with the handle, never counts on its own (see matchedBy).
    attested: byHandle !== null,
  };
}
