"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminDb } from "@/lib/channel/db";
import { supabaseChatStore } from "@/lib/chat/store";

// Server actions for /admin/chat. Every one re-checks the caller is an admin:
// a server action is a public endpoint, so the page's own check is not enough.
async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!user || isAdmin !== true) throw new Error("Not authorized");
  return user.id;
}

const REPLY_MAX = 4000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function userIdFrom(formData: FormData): string {
  const id = String(formData.get("user_id") ?? "");
  if (!UUID_RE.test(id)) throw new Error("Unknown member");
  return id;
}

export async function setChatEnabled(formData: FormData) {
  const uid = await requireAdmin();
  const { error } = await adminDb()
    .from("support_settings")
    .update({ chat_enabled: formData.get("enabled") === "true", updated_by: uid, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(`Couldn't change the switch: ${error.message}`);
  revalidatePath("/admin/chat");
}

/** A person's reply. The thread stays with the team until it's handed back. */
export async function replyToMember(formData: FormData) {
  const staffId = await requireAdmin();
  const userId = userIdFrom(formData);
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  if (body.length > REPLY_MAX) throw new Error(`Replies are capped at ${REPLY_MAX} characters`);
  const store = supabaseChatStore(adminDb());
  await store.addMessage({ user_id: userId, role: "staff", body, staff_id: staffId });
  await store.saveThread({ user_id: userId, state: "needs_human" });
  revalidatePath("/admin/chat");
}

/** Done: the assistant answers this member again. */
export async function resolveThread(formData: FormData) {
  await requireAdmin();
  const userId = userIdFrom(formData);
  const store = supabaseChatStore(adminDb());
  await store.addMessage({ user_id: userId, role: "system", body: "resolved" });
  await store.saveThread({ user_id: userId, state: "bot", handoff_reason: null });
  revalidatePath("/admin/chat");
}
