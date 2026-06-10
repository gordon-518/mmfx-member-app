"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Both actions just relay to the SECURITY DEFINER functions — every rule
// (admin check, qualifying deposit, re-trial eligibility) is enforced in the
// database. Outcomes are surfaced back to /admin via query params.

function backTo(params: Record<string, string>): never {
  redirect(`/admin?${new URLSearchParams(params).toString()}`);
}

export async function verifyDeposit(formData: FormData) {
  const targetUserId = String(formData.get("target_user_id") ?? "");
  const targetEmail = String(formData.get("target_email") ?? "");
  const broker = String(formData.get("broker") ?? "");
  const amountRaw = String(formData.get("amount") ?? "");
  const ibConfirmed = formData.get("ib_confirmed") === "on";

  if (!targetUserId) {
    backTo({ error: "Missing target user", target: targetEmail });
  }
  const amount = Number(amountRaw);
  if (amountRaw === "" || Number.isNaN(amount)) {
    backTo({ error: "Enter a valid deposit amount", target: targetEmail });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    backTo({ error: "Not authenticated", target: targetEmail });
  }

  const { error } = await supabase.rpc("fn_verify_deposit", {
    target_user_id: targetUserId,
    p_broker: broker,
    p_amount: amount,
    p_ib_confirmed: ibConfirmed,
  });

  if (error) {
    backTo({ error: error.message, target: targetEmail });
  }

  revalidatePath("/admin");
  backTo({ ok: `Deposit verified — ${targetEmail} is now a member`, target: targetEmail });
}

export async function grantRetrial(formData: FormData) {
  const targetUserId = String(formData.get("target_user_id") ?? "");
  const targetEmail = String(formData.get("target_email") ?? "");

  if (!targetUserId) {
    backTo({ error: "Missing target user", target: targetEmail });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    backTo({ error: "Not authenticated", target: targetEmail });
  }

  const { error } = await supabase.rpc("fn_grant_retrial", {
    target_user_id: targetUserId,
  });

  if (error) {
    backTo({ error: error.message, target: targetEmail });
  }

  revalidatePath("/admin");
  backTo({ ok: `Re-trial granted to ${targetEmail}`, target: targetEmail });
}
