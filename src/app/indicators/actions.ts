"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Relays to fn_set_tradingview_username, which writes the caller's OWN row
// only (SECURITY DEFINER). Rules/validation live in the function; this just
// surfaces the outcome back to /indicators.

export async function setTradingViewUsername(formData: FormData) {
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
    redirect(
      `/indicators?tv_error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/indicators");
  redirect("/indicators");
}
