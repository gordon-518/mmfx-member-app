"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { grantTVAccess, revokeTVAccess, setTVSession, testTVSession } from "@/lib/tv/client";
import { syncSendpulseAudiences } from "@/lib/sendpulseSync";
import type { AccountStatus } from "@/lib/trial/status";

const TV_ACTIVE = new Set<AccountStatus>(["trial_active", "re_trial_active", "member_active"]);

// Fire-and-forget TV sync after any admin status change. Failures are logged
// but never block the admin action — the daily cron is the safety net.
async function syncTV(
  supabase: Awaited<ReturnType<typeof createClient>>,
  targetUserId: string
) {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("tradingview_username, account_status, trial_ends_at")
      .eq("id", targetUserId)
      .single();
    if (!data?.tradingview_username) return;
    const status = data.account_status as AccountStatus;
    if (TV_ACTIVE.has(status)) {
      const expiresAt = status === "member_active" ? null : data.trial_ends_at;
      await grantTVAccess(data.tradingview_username, expiresAt);
    } else {
      await revokeTVAccess(data.tradingview_username);
    }
  } catch (e) {
    console.error("[tv-sync] admin action failed:", e);
  }
}

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

  await syncTV(supabase, targetUserId);

  revalidatePath("/admin");
  backTo({
    ...filters,
    ok: `Deposit verified — ${targetEmail} is now a member`,
    target: targetEmail,
  });
}

export async function updateMember(formData: FormData) {
  const targetUserId = String(formData.get("target_user_id") ?? "");
  const targetEmail = String(formData.get("target_email") ?? "");
  const filters = filterParams(formData);

  if (!targetUserId) {
    backTo({ ...filters, error: "Missing target user", target: targetEmail });
  }

  // Empty form values mean "leave unchanged" -> null params to the function.
  const status = String(formData.get("status") ?? "");
  const broker = String(formData.get("broker") ?? "");
  const trialEndsAt = String(formData.get("trial_ends_at") ?? "");
  const trialCount = String(formData.get("trial_count") ?? "");

  if (
    trialEndsAt &&
    Number.isNaN(new Date(trialEndsAt).getTime())
  ) {
    backTo({ ...filters, error: "Invalid trial end date", target: targetEmail });
  }

  const supabase = await requireAdmin(filters, targetEmail);

  const { error } = await supabase.rpc("fn_admin_update_member", {
    target_user_id: targetUserId,
    p_status: status || null,
    p_broker: broker || null,
    p_trial_ends_at: trialEndsAt
      ? new Date(trialEndsAt).toISOString()
      : null,
    p_trial_count: trialCount ? Number(trialCount) : null,
  });

  if (error) {
    backTo({ ...filters, error: error.message, target: targetEmail });
  }

  if (status) await syncTV(supabase, targetUserId);

  revalidatePath("/admin");
  backTo({ ...filters, ok: `Updated ${targetEmail}`, target: targetEmail });
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

  await syncTV(supabase, targetUserId);

  revalidatePath("/admin");
  backTo({
    ...filters,
    ok: `Re-trial granted to ${targetEmail}`,
    target: targetEmail,
  });
}

// Manual TradingView session refresh — the fallback for when programmatic
// login is CAPTCHA-blocked. Admin pastes a fresh sessionid + sessionid_sign
// from their browser; we store it and immediately test it.
export async function saveTvSession(formData: FormData) {
  const sessionid = String(formData.get("sessionid") ?? "").trim();
  const sign = String(formData.get("sessionid_sign") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/admin?error=${encodeURIComponent("Not authenticated")}`);
  }
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) {
    redirect(`/admin?error=${encodeURIComponent("Not authorized")}`);
  }

  if (!sessionid || !sign) {
    redirect(`/admin?error=${encodeURIComponent("Paste both sessionid and sessionid_sign")}`);
  }

  await setTVSession(sessionid, sign);
  const test = await testTVSession();

  revalidatePath("/admin");
  if (test.ok) {
    redirect(`/admin?ok=${encodeURIComponent("TradingView session saved — live ✓")}`);
  }
  redirect(
    `/admin?ok=${encodeURIComponent(`Session saved, but the test call failed: ${test.detail ?? "unknown"}`)}`
  );
}

// Manually run the SendPulse audience sync (tags every contact with their
// membership status for segmentation). Also runs nightly via cron.
export async function runSendpulseSync() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/admin?error=${encodeURIComponent("Not authenticated")}`);
  }
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) {
    redirect(`/admin?error=${encodeURIComponent("Not authorized")}`);
  }

  const r = await syncSendpulseAudiences();

  revalidatePath("/admin");
  if (r.error) {
    redirect(`/admin?error=${encodeURIComponent(`SendPulse sync failed: ${r.error}`)}`);
  }
  const c = r.counts;
  redirect(
    `/admin?ok=${encodeURIComponent(
      `SendPulse synced ${r.synced}/${r.total} — member ${c.member ?? 0}, trial ${c.trial ?? 0}, expired ${c.expired ?? 0}, removed ${c.removed ?? 0}`
    )}`
  );
}
