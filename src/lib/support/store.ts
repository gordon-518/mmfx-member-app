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
}

export interface SupportStore {
  getSettings(): Promise<SupportSettings | null>;
  getChat(contactId: string): Promise<ChatRow | null>;
  saveChat(patch: Partial<ChatRow> & { contact_id: string }): Promise<void>;
  countRepliesSince(contactId: string, sinceIso: string): Promise<number>;
  countModelCallsSince(sinceIso: string): Promise<number>;
  /** Texts the agent itself sent to this chat recently (replies and holding lines). */
  recentAgentTexts(contactId: string, sinceIso: string): Promise<string[]>;
  /** Insert an event. Returns false on a duplicate dedupe_key or any insert error. */
  log(ev: EventRow): Promise<boolean>;
}

export function supabaseStore(db: SupabaseClient = adminDb()): SupportStore {
  return {
    async getSettings() {
      const { data } = await db.from("support_settings").select("*").eq("id", 1).maybeSingle();
      return (data as SupportSettings | null) ?? null;
    },
    async getChat(contactId) {
      const { data } = await db.from("support_chats").select("*").eq("contact_id", contactId).maybeSingle();
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
        .eq("contact_id", contactId).in("kind", ["reply", "handoff"]).gte("created_at", sinceIso);
      return ((data ?? []) as { reply_text: string | null }[]).map((r) => r.reply_text).filter((t): t is string => Boolean(t));
    },
    async log(ev) {
      const { error } = await db.from("support_events").insert(ev);
      return !error;
    },
  };
}
