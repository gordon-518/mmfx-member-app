"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateTradingAccount } from "@/lib/tradingAccount";

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
  const check = validateTradingAccount(value);
  if (!check.ok) return { ok: false, error: check.message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const { error } = await supabase.rpc("fn_set_trading_account", {
    p_number: value.trim(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
