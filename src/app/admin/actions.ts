"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { grantTVAccess, revokeTVAccess, setTVSession, testTVSession } from "@/lib/tv/client";
import { syncSendpulseAudiences } from "@/lib/sendpulseSync";
import { sendCapiEvent } from "@/lib/meta-capi";
import { banUserById, deleteUserById } from "@/lib/adminUsers";
import type { AccountStatus } from "@/lib/trial/status";

import { logEventAfter } from "@/lib/events";
import { tierFor, tierLabel, type TierSnapshot } from "@/lib/tiers";
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

const FILTER_KEYS = ["q", "status", "broker", "country"] as const;

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

  // conversion-fix 3.2 — the member's state BEFORE this verification decides
  // whether it's a first deposit (the only kind that fires CAPI Purchase) or a
  // top-up, and which tier they move from.
  const { data: before } = await supabase
    .from("profiles")
    .select("account_status, trial_ends_at, deposit_amount, grandfathered, deposit_verified_at")
    .eq("id", targetUserId)
    .single();

  const { data: after, error } = await supabase.rpc("fn_verify_deposit", {
    target_user_id: targetUserId,
    p_broker: broker,
    p_amount: amount,
    p_ib_confirmed: ibConfirmed,
  });

  if (error) {
    backTo({ ...filters, error: error.message, target: targetEmail });
  }

  await syncTV(supabase, targetUserId);

  // A first deposit flips a non-member to member_active and has never been
  // verified before. Re-verifying a removed member, or a grandfathered member's
  // first recorded deposit, is not a new funded account.
  const isFirstDeposit =
    before != null && before.deposit_verified_at == null && before.account_status !== "member_active";
  const tierBefore = before ? tierFor(before as TierSnapshot) : "free";
  const tierAfter = after ? tierFor(after as TierSnapshot) : tierBefore;
  const cumulative = Number((after as { deposit_amount?: number | string } | null)?.deposit_amount ?? amount);

  // conversion-fix 1.3 / 3.2 — the money events, logged for the MEMBER (not the
  // admin clicking verify) through the server-side path, after the response.
  // tier is the tier the NEW CUMULATIVE total reaches, not this one deposit's.
  logEventAfter(targetUserId, "deposit_verified", {
    amount,
    broker,
    cumulative,
    tier: tierAfter,
    first: isFirstDeposit,
  });
  if (tierAfter !== tierBefore) {
    logEventAfter(targetUserId, "tier_changed", { from: tierBefore, to: tierAfter });
  }

  // Funded-account conversion — the money event that ties ad spend to IB
  // revenue. action_source "website" (not "system_generated"): the conversion
  // culminates the web funnel, it optimizes as a standard web conversion, and —
  // unlike system_generated — it renders in Events Manager Test Events. Matched
  // on email + user id. Guarded so a Meta hiccup never blocks admin verify.
  // FIRST DEPOSIT ONLY (decided 10 Sept): now that top-ups are recorded, firing
  // on every verification would send Meta a second Purchase for one account.
  if (isFirstDeposit) {
    try {
      await sendCapiEvent({
        eventName: "Purchase",
        actionSource: "website",
        eventSourceUrl: "https://app.marketmakersfx.net/upgrade",
        user: { email: targetEmail, externalId: targetUserId },
        customData: { value: amount, currency: "USD", content_name: "funded_account", broker },
      });
    } catch (e) {
      console.error("[meta-capi] Purchase failed:", e);
    }
  }

  revalidatePath("/admin");
  backTo({
    ...filters,
    ok: isFirstDeposit
      ? `Deposit verified — ${targetEmail} is now a ${tierLabel(tierAfter)} member ($${cumulative})`
      : `Top-up recorded — ${targetEmail}: $${cumulative} cumulative, ${tierLabel(tierAfter)}`,
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

// ── User management (Ban / Delete) ────────────────────────────────────────────
// Return-style actions (called directly from the UserAdmin client component and
// awaited), NOT the redirect pattern above. Every one re-checks is_admin and
// re-resolves the target server-side via fn_admin_find_user (exact-email match),
// so the client can never widen the target. Deletes are guarded further.

export interface FoundUser {
  id: string;
  email: string;
  account_status: string | null;
  banned: boolean;
}
export type UserLookupResult =
  | { ok: true; user: FoundUser }
  | { ok: false; error: string };
export type UserActionResult = { ok: true; message: string } | { ok: false; error: string };

async function adminOrError(): Promise<
  { ok: true; supabase: Awaited<ReturnType<typeof createClient>> } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) return { ok: false, error: "Not authorized" };
  return { ok: true, supabase };
}

// Resolve exactly one user by exact email, or an error. Shared by all three.
async function resolveOne(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string
): Promise<{ ok: true; user: FoundUser } | { ok: false; error: string }> {
  const clean = email.trim();
  if (!clean) return { ok: false, error: "Enter an email." };
  const { data, error } = await supabase.rpc("fn_admin_find_user", { p_email: clean });
  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []) as FoundUser[];
  if (rows.length === 0) return { ok: false, error: `No account matches ${clean}.` };
  if (rows.length > 1) return { ok: false, error: `${rows.length} accounts matched — refusing.` };
  return { ok: true, user: rows[0] };
}

export async function lookupUser(email: string): Promise<UserLookupResult> {
  const gate = await adminOrError();
  if (!gate.ok) return { ok: false, error: gate.error };
  return resolveOne(gate.supabase, email);
}

export async function banUser(email: string, ban: boolean): Promise<UserActionResult> {
  const gate = await adminOrError();
  if (!gate.ok) return { ok: false, error: gate.error };
  const found = await resolveOne(gate.supabase, email);
  if (!found.ok) return found;
  const r = await banUserById(found.user.id, ban);
  if (!r.ok) return { ok: false, error: r.error ?? "Failed." };
  revalidatePath("/admin");
  return { ok: true, message: `${found.user.email} ${ban ? "banned" : "unbanned"}.` };
}

export async function deleteUser(email: string, confirmEmail: string): Promise<UserActionResult> {
  const gate = await adminOrError();
  if (!gate.ok) return { ok: false, error: gate.error };
  const found = await resolveOne(gate.supabase, email);
  if (!found.ok) return found;
  if (confirmEmail.trim().toLowerCase() !== found.user.email.toLowerCase()) {
    return { ok: false, error: "Confirmation email doesn't match — nothing deleted." };
  }
  if (found.user.account_status === "member_active") {
    return { ok: false, error: "Refusing: this is a paying member. Downgrade first if you truly mean to delete." };
  }
  const r = await deleteUserById(found.user.id);
  if (!r.ok) return { ok: false, error: r.error ?? "Failed." };
  revalidatePath("/admin");
  return { ok: true, message: `${found.user.email} permanently deleted.` };
}
