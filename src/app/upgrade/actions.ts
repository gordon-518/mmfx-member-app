"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendAdminTelegram } from "@/lib/telegram";
import { sendAdminAlert } from "@/lib/notify";
import { buildDepositAlert } from "@/lib/depositAlert";
import { isClientEvent, sanitizeClientProps } from "@/lib/eventNames";
import { depositRef } from "@/lib/depositRef";
import { depositErrorKey } from "@/lib/depositErrors";
import { getT } from "@/i18n/server";

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

export type DepositFormState =
  | { ok: true; amount: number; broker: string; account: string }
  | { error: string }
  | null;

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
  const e = (await getT()).upgrade.errors;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: e.session };

  const broker = String(formData.get("broker") ?? "");
  const account = String(formData.get("account") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const tradingview = String(formData.get("tradingview") ?? "").trim();
  const telegram = String(formData.get("telegram") ?? "").trim().replace(/^@/, "");
  const proof = formData.get("proof");

  // Required (15 Sep), checked before the upload so a typo doesn't cost an upload.
  if (!/^[A-Za-z0-9_]{5,32}$/.test(telegram)) {
    return { error: e.telegram };
  }

  if (!(proof instanceof File) || proof.size === 0) {
    return { error: e.screenshot };
  }
  if (proof.size > MAX_PROOF_BYTES) {
    return { error: e.size };
  }
  const ext = PROOF_TYPES[proof.type];
  if (!ext) return { error: e.format };

  const path = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("deposit-proofs")
    .upload(path, proof, { contentType: proof.type, upsert: false });
  if (uploadError) {
    console.error("[deposit-submit] upload failed:", uploadError.message);
    return { error: e.upload };
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
    // fn_submit_deposit raises member-facing messages, shown in the member's
    // language; anything else is unexpected, so it's logged and kept generic.
    const key = depositErrorKey(error.message);
    if (!key) console.error("[deposit-submit] rpc failed:", error.message);
    return { error: e[key ?? "generic"] };
  }

  // conversion-fix 5.3 — tell the admin a submission is waiting. Both channels
  // (17 Sep): Telegram to the alert bot (@MMbrainerbot on the VPS) AND email,
  // so a silent Telegram failure can no longer hide a waiting deposit. The
  // trading account number is in both, to check the broker back office.
  // Best-effort: neither send throws, and neither can fail the submission.
  const alert = buildDepositAlert({
    email: user.email ?? user.id,
    amount,
    broker,
    account,
    tradingview: tradingview || null,
    telegram,
    ref: depositRef(user.id),
  });
  const [tg, mail] = await Promise.all([
    sendAdminTelegram(alert.html),
    sendAdminAlert(alert.subject, alert.text),
  ]);
  if (!tg.ok) console.error("[deposit-submit] admin Telegram alert failed:", tg.detail);
  if (!mail.ok) console.error("[deposit-submit] admin email alert failed:", mail.detail);

  revalidatePath("/upgrade");
  return { ok: true, amount, broker, account };
}

// The last step after submitting: the member clicked "Message Admin Amelia".
// Stamps their own pending submission, which stops the 24-hour reminder email
// (fn_mark_submission_dm_clicked takes no arguments, so it can't mark anyone
// else's). Fire-and-forget from the browser; never throws.
export async function markAdminDmClicked(): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("fn_mark_submission_dm_clicked");
    if (error) console.error("[deposit-dm] mark clicked failed:", error.message);
  } catch (e) {
    console.error("[deposit-dm] mark clicked threw:", e);
  }
}
