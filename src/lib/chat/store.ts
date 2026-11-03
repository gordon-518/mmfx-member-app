import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminDb } from "@/lib/channel/db";
import type { SupportSettings } from "@/lib/support/types";
import type { ChatMessage, ChatRole, ChatState } from "./types";

// Storage for the in-app support chat (chat_threads / chat_messages). The
// route and the admin actions write with the service role after checking who
// is asking; members and admins can also read through RLS.

export interface ChatThread {
  user_id: string;
  state: ChatState;
  locale: string | null;
  handoff_reason: string | null;
  last_ping_at: string | null;
  member_last_read_at: string | null;
}

export interface NewMessage {
  user_id: string;
  role: ChatRole;
  body: string;
  topic?: string | null;
  confidence?: number | null;
  model?: string | null;
  guard_failures?: string[] | null;
  staff_id?: string | null;
}

/** fn_chat_claim's answer: the member's one-at-a-time claim (see the migration). */
export type ClaimResult = "ok" | "busy" | "rate_limited";

export interface ChatStore {
  getSettings(): Promise<(SupportSettings & { chat_enabled: boolean }) | null>;
  /**
   * Atomically: create the thread if needed, take the member's claim (one
   * request in flight per member), and check the hourly message limit. On
   * "ok" the caller must release() when done.
   */
  claim(userId: string, locale: string, hourLimit: number): Promise<ClaimResult>;
  /** Give the claim back. Best-effort: it also expires on its own. */
  release(userId: string): Promise<void>;
  /** The member has seen the team's replies. Doesn't count as thread activity. */
  markRead(userId: string): Promise<void>;
  /** Threads pinged since then: the brake on a flood of alerts across members. */
  countPingsSince(sinceIso: string): Promise<number>;
  getThread(userId: string): Promise<ChatThread | null>;
  /** Insert or update the member's thread. Throws on a failed write. */
  saveThread(patch: Partial<ChatThread> & { user_id: string }): Promise<void>;
  addMessage(m: NewMessage): Promise<ChatMessage>;
  /** The latest messages, oldest first. */
  recent(userId: string, limit: number): Promise<ChatMessage[]>;
  countAssistantCallsSince(sinceIso: string): Promise<number>;
}

const MESSAGE_COLUMNS = "id, role, body, created_at";

export function supabaseChatStore(db: SupabaseClient = adminDb()): ChatStore {
  return {
    async getSettings() {
      const { data, error } = await db.from("support_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw new Error(`chat settings read failed: ${error.message}`);
      return data as (SupportSettings & { chat_enabled: boolean }) | null;
    },
    async claim(userId, locale, hourLimit) {
      const { data, error } = await db.rpc("fn_chat_claim", { p_user: userId, p_locale: locale, p_hour_limit: hourLimit });
      if (error) throw new Error(`chat claim failed: ${error.message}`);
      if (data === "ok" || data === "busy" || data === "rate_limited") return data;
      throw new Error(`chat claim returned ${String(data)}`);
    },
    async release(userId) {
      const { error } = await db.from("chat_threads").update({ busy_until: null }).eq("user_id", userId);
      if (error) console.error("[chat] releasing the claim failed:", error.message);
    },
    async markRead(userId) {
      const { error } = await db
        .from("chat_threads")
        .update({ member_last_read_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) console.error("[chat] marking read failed:", error.message);
    },
    async countPingsSince(sinceIso) {
      const { count, error } = await db
        .from("chat_threads")
        .select("user_id", { count: "exact", head: true })
        .gte("last_ping_at", sinceIso);
      if (error) throw new Error(`chat ping count failed: ${error.message}`);
      return count ?? 0;
    },
    async getThread(userId) {
      const { data, error } = await db
        .from("chat_threads")
        .select("user_id, state, locale, handoff_reason, last_ping_at, member_last_read_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(`chat thread read failed: ${error.message}`);
      return data as ChatThread | null;
    },
    async saveThread(patch) {
      const { error } = await db
        .from("chat_threads")
        .upsert({ ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw new Error(`chat thread write failed: ${error.message}`);
    },
    async addMessage(m) {
      const { data, error } = await db.from("chat_messages").insert(m).select(MESSAGE_COLUMNS).single();
      if (error) throw new Error(`chat message write failed: ${error.message}`);
      return data as ChatMessage;
    },
    async recent(userId, limit) {
      const { data, error } = await db
        .from("chat_messages")
        .select(MESSAGE_COLUMNS)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit);
      if (error) throw new Error(`chat messages read failed: ${error.message}`);
      return ((data ?? []) as ChatMessage[]).reverse();
    },
    async countAssistantCallsSince(sinceIso) {
      const { count, error } = await db
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .not("model", "is", null)
        .gte("created_at", sinceIso);
      if (error) throw new Error(`chat budget read failed: ${error.message}`);
      return count ?? 0;
    },
  };
}
