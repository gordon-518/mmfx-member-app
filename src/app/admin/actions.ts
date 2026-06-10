"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Both actions relay to the SECURITY DEFINER functions — every rule (admin
// check, qualifying deposit, re-trial eligibility) is enforced in the
// database. The is_admin pre-check here is defense-in-depth and a clean
// rejection for non-admins, never the gate itself. Outcomes are surfaced
// back to /admin via query params; active filters are threaded through so
// an action doesn't dump the admin out of a filtered view.

const FILTER_KEYS = ["q", "status", "broker"] as const;

function filterParams(formData: FormData): Record<string, string> {
  const params: Record<string, string> = {};
  for (const key of FILTER_KEYS) {
    const value = formData.get(`filter_${key}`);
    if (typeof value === "string" && value) params[key] = value;
  }
  return params;
}

function backTo(params: Record<string, string>): never {
  redirect(`/admin?${new URLSearchParams(params).toString()}`);
}

async function requireAdmin(
  filters: Record<string, string>,
  targetEmail: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    backTo({ ...filters, error: "Not authenticated", target: targetEmail });
  }
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) {
    backTo({ ...filters, error: "Not authorized", target: targetEmail });
  }
  return supabase;
}

export async function verifyDeposit(formData: FormData) {
  const targetUserId = String(formData.get("target_user_id") ?? "");
  const targetEmail = String(formData.get("target_email") ?? "");
  const broker = String(formData.get("broker") ?? "");
  const amountRaw = String(formData.get("amount") ?? "");
  const ibConfirmed = formData.get("ib_confirmed") === "on";
  const filters = filterParams(formData);

  if (!targetUserId) {
    backTo({ ...filters, error: "Missing target user", target: targetEmail });
  }
  const amount = Number(amountRaw);
  if (amountRaw === "" || Number.isNaN(amount)) {
    backTo({ ...filters, error: "Enter a valid deposit amount", target: targetEmail });
  }

  const supabase = await requireAdmin(filters, targetEmail);

  const { error } = await supabase.rpc("fn_verify_deposit", {
    target_user_id: targetUserId,
    p_broker: broker,
    p_amount: amount,
    p_ib_confirmed: ibConfirmed,
  });

  if (error) {
    backTo({ ...filters, error: error.message, target: targetEmail });
  }

  revalidatePath("/admin");
  backTo({
    ...filters,
    ok: `Deposit verified — ${targetEmail} is now a member`,
    target: targetEmail,
  });
}

export async function grantRetrial(formData: FormData) {
  const targetUserId = String(formData.get("target_user_id") ?? "");
  const targetEmail = String(formData.get("target_email") ?? "");
  const filters = filterParams(formData);

  if (!targetUserId) {
    backTo({ ...filters, error: "Missing target user", target: targetEmail });
  }

  const supabase = await requireAdmin(filters, targetEmail);

  const { error } = await supabase.rpc("fn_grant_retrial", {
    target_user_id: targetUserId,
  });

  if (error) {
    backTo({ ...filters, error: error.message, target: targetEmail });
  }

  revalidatePath("/admin");
  backTo({
    ...filters,
    ok: `Re-trial granted to ${targetEmail}`,
    target: targetEmail,
  });
}
