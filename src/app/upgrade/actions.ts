"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendTelegram, escapeHtml } from "@/lib/telegram";
import { isClientEvent, sanitizeClientProps } from "@/lib/eventNames";
import { depositRef } from "@/lib/depositRef";

// Funnel clicks on /upgrade (conversion-fix 1.3): broker links and the
// WhatsApp / Telegram contact buttons. Called fire-and-forget from the browser
// as the link opens in a new tab, so it must never throw back to the caller.
//
// Both arguments come from the browser, so they're validated here AND by the
// database: fn_log_event takes the user from auth.uid() and accepts only the
// two click events, so a caller can't log for someone else or forge a
// server-side event such as deposit_verified.
export async function logUpgradeClick(event: unknown, props: unknown): Promise<void> {
  if (!isClientEvent(event)) return;
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("fn_log_event", {
      p_event: event,
      p_props: sanitizeClientProps(event, props),
    });
    if (error) console.error(`[events] ${event} failed:`, error.message);
  } catch (e) {
    console.error(`[events] ${event} threw:`, e);
  }
}

// ─── conversion-fix 5.1 / 5.4 — deposit submission ───────────────────────────
// The form on /upgrade posts here. The screenshot is uploaded with the USER's
// session into their own folder of the private deposit-proofs bucket (storage
// RLS enforces the folder), then fn_submit_deposit validates the rest and
// records the submission. A paid member's submission is a top-up through the
// same queue.

export type DepositFormState = { ok: true; amount: number } | { error: string } | null;

const PROOF_TYPES: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAX_PROOF_BYTES = 10 * 1024 * 1024;

export async function submitDeposit(
  _prev: DepositFormState,
  formData: FormData
): Promise<DepositFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has ended. Sign in again and resubmit." };

  const broker = String(formData.get("broker") ?? "");
  const account = String(formData.get("account") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const tradingview = String(formData.get("tradingview") ?? "").trim();
  const telegram = String(formData.get("telegram") ?? "").trim().replace(/^@/, "");
  const proof = formData.get("proof");

  // Required (15 Sep), checked before the upload so a typo doesn't cost an upload.
  if (!/^[A-Za-z0-9_]{5,32}$/.test(telegram)) {
    return { error: "Enter your Telegram username (the @handle, 5 to 32 letters, numbers or underscores)." };
  }

  if (!(proof instanceof File) || proof.size === 0) {
    return { error: "Upload a screenshot of your deposit." };
  }
  if (proof.size > MAX_PROOF_BYTES) {
    return { error: "The screenshot must be under 10 MB." };
  }
  const ext = PROOF_TYPES[proof.type];
  if (!ext) return { error: "Upload the screenshot as a PNG, JPG or WebP image." };

  const path = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("deposit-proofs")
    .upload(path, proof, { contentType: proof.type, upsert: false });
  if (uploadError) {
    console.error("[deposit-submit] upload failed:", uploadError.message);
    return { error: "The screenshot couldn't be uploaded. Try again." };
  }

  const { error } = await supabase.rpc("fn_submit_deposit", {
    p_broker: broker,
    p_trading_account_number: account,
    p_amount: amount,
    p_tradingview_username: tradingview || null,
    p_proof_path: path,
    p_telegram_username: telegram,
  });
  if (error) {
    // fn_submit_deposit raises member-facing messages; anything else is generic.
    const known = /broker|account number|minimum deposit|TradingView|Telegram|screenshot|waiting for review/i.test(error.message);
    if (!known) console.error("[deposit-submit] rpc failed:", error.message);
    return { error: known ? error.message : "Something went wrong. Try again, or message us." };
  }

  // conversion-fix 5.3 — tell the admin a submission is waiting. Best-effort:
  // sendTelegram never throws, and a failed DM doesn't fail the submission.
  const tg = await sendTelegram(
    `💰 <b>New deposit submission</b>\n${escapeHtml(user.email ?? user.id)}: $${amount.toLocaleString("en-US")} · ${escapeHtml(broker)}\nTelegram: @${escapeHtml(telegram)} · ref ${depositRef(user.id)}\nReview: https://app.marketmakersfx.net/admin`
  );
  if (!tg.ok) console.error("[deposit-submit] admin Telegram DM failed:", tg.detail);

  revalidatePath("/upgrade");
  return { ok: true, amount };
}
