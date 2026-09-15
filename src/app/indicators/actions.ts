"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { grantTVAccess } from "@/lib/tv/client";
import { tvEntitlement, type TvProfileRow } from "@/lib/tv/resolveTvAccounts";
import { validateTradingViewUsername } from "@/lib/tvUsername";


// Relays to fn_set_tradingview_username, which writes the caller's OWN row
// only (SECURITY DEFINER). Rules/validation live in the function; this just
// surfaces the outcome back to /indicators.

export async function setTradingViewUsername(formData: FormData) {
  const username = String(formData.get("tradingview_username") ?? "");

  // Catch the common mistakes (email / display name with spaces / bad chars)
  // before we grant to a handle that doesn't exist.
  const check = validateTradingViewUsername(username);
  if (!check.ok) {
    redirect(`/indicators?tv_error=${encodeURIComponent(check.message)}`);
  }

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
    redirect(`/indicators?tv_error=${encodeURIComponent(error.message)}`);
  }

  // Grant TV access immediately — non-blocking, cron is the safety net
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_status, trial_ends_at, deposit_amount, grandfathered, lifetime_plan")
      .eq("id", user.id)
      .single();
    const ent = profile ? tvEntitlement(profile as TvProfileRow & { tradingview_username: string | null }) : null;
    if (ent?.grant) {
      await grantTVAccess(username.trim(), ent.expiresAt);
    }
  } catch (e) {
    console.error("[tv-sync] setTradingViewUsername:", e);
  }

  revalidatePath("/indicators");
  redirect("/indicators");
}
