"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateTradingAccount } from "@/lib/tradingAccount";
import { getT } from "@/i18n/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/dashboard");
}

export type SaveResult = { ok: true } | { ok: false; error: string };

// Save the caller's own trading account number. Relays to
// fn_set_trading_account (own-row, SECURITY DEFINER); validated both here and in
// the DB. Return-style so the bar/gate can show inline feedback.
export async function setTradingAccount(value: string): Promise<SaveResult> {
  const t = await getT();
  const check = validateTradingAccount(value, t.account);
  if (!check.ok) return { ok: false, error: check.message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: t.account.errSignIn };

  const { error } = await supabase.rpc("fn_set_trading_account", {
    p_number: value.trim(),
  });
  if (error) {
    // The DB repeats the client-side checks, so a raw Postgres message here
    // would only ever be an English duplicate of one we already translate.
    console.error("[trading-account] save failed:", error.message);
    return { ok: false, error: t.account.errSave };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
