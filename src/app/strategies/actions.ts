"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { grantTVAccess } from "@/lib/tv/client";
import type { AccountStatus } from "@/lib/trial/status";

const TV_ACTIVE = new Set<AccountStatus>(["trial_active", "re_trial_active", "member_active"]);

export async function setTradingViewUsernameFromStrategies(formData: FormData) {
  const username = String(formData.get("tradingview_username") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.rpc("fn_set_tradingview_username", {
    p_username: username,
  });

  if (error) {
    redirect(`/strategies?tv_error=${encodeURIComponent(error.message)}`);
  }

  // Grant TV access immediately — non-blocking, cron is the safety net
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_status, trial_ends_at")
      .eq("id", user.id)
      .single();
    if (profile && TV_ACTIVE.has(profile.account_status as AccountStatus)) {
      const expiresAt =
        profile.account_status === "member_active" ? null : profile.trial_ends_at;
      await grantTVAccess(username.trim(), expiresAt);
    }
  } catch (e) {
    console.error("[tv-sync] setTradingViewUsernameFromStrategies:", e);
  }

  revalidatePath("/strategies");
  redirect("/strategies");
}
