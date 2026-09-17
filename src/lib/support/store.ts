import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminDb } from "@/lib/channel/db";
import type { SupportSettings } from "./types";

export interface ChatRow {
  contact_id: string;
  is_business?: boolean;
  telegram_username?: string | null;
  matched_user_id?: string | null;
  state: "auto" | "quiet" | "needs_amelia";
  quiet_until?: string | null;
  handoff_reason?: string | null;
  last_member_msg_at?: string | null;
  last_agent_reply_at?: string | null;
}

export interface EventRow {
  contact_id: string;
  kind: "incoming" | "reply" | "handoff" | "skip" | "error" | "amelia_reply";
  dedupe_key?: string;
  member_text?: string;
  topic?: string;
  confidence?: number;
  reply_text?: string;
  skip_reason?: string;
  guard_failures?: string[];
  model?: string;
  latency_ms?: number;
  /** Set once SendPulse confirmed the send (see store.markDelivered). A
   * reply or handoff row with a null delivered_at was logged but never
   * confirmed — the run may have been killed between the two. */
  delivered_at?: string;
}

/** Result of `log`: "duplicate" means the dedupe_key was already claimed by
 * another row (used as the outcome lock — see run.ts) and nothing new was
 * inserted. Any other insert failure throws instead of resolving, so a
 * transient DB error is never mistaken for "someone else already answered". */
export type LogResult = { status: "ok" } | { status: "duplicate" };

export interface SupportStore {
  getSettings(): Promise<SupportSettings | null>;
  getChat(contactId: string): Promise<ChatRow | null>;
  saveChat(patch: Partial<ChatRow> & { contact_id: string }): Promise<void>;
  countRepliesSince(contactId: string, sinceIso: string): Promise<number>;
  countModelCallsSince(sinceIso: string): Promise<number>;
  /** Texts the agent itself sent to this chat recently (replies and holding lines). */
  recentAgentTexts(contactId: string, sinceIso: string): Promise<string[]>;
  /** Insert an event. `{ status: "duplicate" }` on a dedupe_key collision;
   * throws on any other insert error (never resolves `false` for that — a
   * transient failure must not be read as "already claimed"). */
  log(ev: EventRow): Promise<LogResult>;
  /** Best-effort: mark an already-logged reply/handoff row as confirmed-sent
   * by its dedupe_key. Never throws — a failure here must not turn a
   * successful send into a thrown error. */
  markDelivered(dedupeKey: string): Promise<void>;
  /** Best-effort: overwrite skip_reason on an already-logged event by its
   * dedupe_key (used to record handoff write-side-effect failures after the
   * fact — see run.ts's `handoff`). Never throws. */
  patchSkipReason(dedupeKey: string, skipReason: string): Promise<void>;
}

export function supabaseStore(db: SupabaseClient = adminDb()): SupportStore {
  return {
    async getSettings() {
      const { data, error } = await db.from("support_settings").select("*").eq("id", 1).maybeSingle();
      // Must throw, not return null: the caller's null case reads as "no
      // settings row" (a valid, if surprising, state) rather than a failed
      // read, and support_settings' single row gates the on/off switch.
      if (error) throw new Error(`support_settings read failed: ${error.message}`);
      return (data as SupportSettings | null) ?? null;
    },
    async getChat(contactId) {
      const { data, error } = await db.from("support_chats").select("*").eq("contact_id", contactId).maybeSingle();
      // Must throw, not return null: a failed read reading as "no row" would
      // make the agent treat a needs_amelia chat as fresh ("auto") and reply
      // straight over Admin Amelia — the one state that must never fail open.
      if (error) throw new Error(`support_chats read failed: ${error.message}`);
      return (data as ChatRow | null) ?? null;
    },
    async saveChat(patch) {
      await db.from("support_chats").upsert({ ...patch, updated_at: new Date().toISOString() }, { onConflict: "contact_id" });
    },
    async countRepliesSince(contactId, sinceIso) {
      const { count } = await db.from("support_events").select("id", { count: "exact", head: true })
        .eq("contact_id", contactId).eq("kind", "reply").gte("created_at", sinceIso);
      return count ?? 0;
    },
    async countModelCallsSince(sinceIso) {
      const { count } = await db.from("support_events").select("id", { count: "exact", head: true })
        .not("model", "is", null).gte("created_at", sinceIso);
      return count ?? 0;
    },
    async recentAgentTexts(contactId, sinceIso) {
      const { data } = await db.from("support_events").select("reply_text")
        .eq("contact_id", contactId).in("kind", ["reply", "handoff"]).gte("created_at", sinceIso)
        .order("created_at", { ascending: false }).limit(50);
      return ((data ?? []) as { reply_text: string | null }[]).map((r) => r.reply_text).filter((t): t is string => Boolean(t));
    },
    async log(ev) {
      const { error } = await db.from("support_events").insert(ev);
      if (!error) return { status: "ok" };
      if (error.code === "23505") return { status: "duplicate" };
      throw new Error(`support_events insert failed: ${error.message}`);
    },
    async markDelivered(dedupeKey) {
      await db.from("support_events").update({ delivered_at: new Date().toISOString() }).eq("dedupe_key", dedupeKey);
    },
    async patchSkipReason(dedupeKey, skipReason) {
      await db.from("support_events").update({ skip_reason: skipReason }).eq("dedupe_key", dedupeKey);
    },
  };
}
