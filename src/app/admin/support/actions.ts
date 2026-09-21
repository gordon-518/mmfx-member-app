"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminDb } from "@/lib/channel/db";
import { deleteTag, deletePauseAutomation } from "@/lib/support/sendpulse";
import { parseAccounts, parseFlows } from "@/lib/support/settingsForm";

// Server actions for /admin/support. Every one re-checks the caller is an
// admin: a server action is a public endpoint, so the page's own check is not
// enough on its own.
async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!user || isAdmin !== true) throw new Error("Not authorized");
  return user.id;
}

export async function setEnabled(formData: FormData) {
  const uid = await requireAdmin();
  await adminDb().from("support_settings")
    .update({ enabled: formData.get("enabled") === "true", updated_by: uid, updated_at: new Date().toISOString() })
    .eq("id", 1);
  revalidatePath("/admin/support");
}

export async function saveSettings(formData: FormData) {
  const uid = await requireAdmin();
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const expires = str("bonus_code_expires");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expires)) throw new Error("Bonus expiry must be a date (YYYY-MM-DD)");
  await adminDb().from("support_settings").update({
    bonus_code: str("bonus_code"),
    bonus_code_expires: expires,
    office_hours: str("office_hours"),
    trade_cadence: str("trade_cadence"),
    notes: str("notes"),
    official_accounts: parseAccounts(str("official_accounts")),
    approved_flows: parseFlows(str("approved_flows")),
    updated_by: uid,
    updated_at: new Date().toISOString(),
  }).eq("id", 1);
  revalidatePath("/admin/support");
}

/** Hand a Needs-Amelia chat back to the agent: the state, the SendPulse tag
 * (which also backstops a lost row — see run.ts) and the 24h automation pause
 * must all be cleared, or the agent will keep skipping the chat. */
export async function clearChat(formData: FormData) {
  await requireAdmin();
  const contactId = String(formData.get("contact_id") ?? "");
  if (!contactId) return;
  await adminDb().from("support_chats")
    .update({ state: "auto", handoff_reason: null, quiet_until: null, updated_at: new Date().toISOString() })
    .eq("contact_id", contactId);
  await deleteTag(contactId, "needs-amelia");
  await deletePauseAutomation(contactId);
  revalidatePath("/admin/support");
}
