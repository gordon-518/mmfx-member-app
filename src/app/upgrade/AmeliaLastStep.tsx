"use client";

import { useState } from "react";
import { logUpgradeClick, markAdminDmClicked } from "./actions";
import { ADMIN_DISPLAY_NAME, ADMIN_TELEGRAM_URL, adminDmMessage } from "@/lib/depositRef";

// The deposit form's last step (Gordon, 15 Sep). Once the submission is in,
// the member messages Admin Amelia (@MM_3000) on Telegram: the desk shouldn't
// message members first. The click is recorded (admin_dm_clicked_at); a member
// who hasn't clicked within 24 hours gets one reminder email from
// /api/cron/deposit-dm-reminder. The DM itself can't be seen, so the click is
// the signal.

const STEP = "text-[11px] font-bold uppercase tracking-[0.12em] text-orange";

export function AmeliaLastStep({
  refCode,
  amount,
  isTopUp,
  clicked,
}: {
  refCode: string;
  amount: number;
  isTopUp: boolean;
  clicked: boolean;
}) {
  const [done, setDone] = useState(clicked);
  const [copied, setCopied] = useState(false);
  const message = adminDmMessage(refCode, amount);
  const at = message.indexOf(refCode);

  const open = () => {
    setDone(true);
    void markAdminDmClicked();
    void logUpgradeClick("upgrade_contact_clicked", { channel: "telegram" });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      // Clipboard blocked: the message is on screen to copy by hand.
    }
  };

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-line bg-paper px-4 py-3 text-[14px] text-ink">
        {`Your $${amount.toLocaleString("en-US")} ${isTopUp ? "top-up" : "deposit"} is in for review. We'll switch your access on as soon as it's verified.`}
      </p>

      <div className="rounded-xl border border-orange/25 bg-accent-soft/30 p-4">
        <p className={STEP}>{done ? "Last step · done" : "Last step"}</p>
        <p className="mt-1 text-[14.5px] font-semibold text-ink">Message {ADMIN_DISPLAY_NAME} on Telegram</p>
        <p className="mt-1 text-[13px] leading-relaxed text-subtle">
          {done
            ? `Thanks. ${ADMIN_DISPLAY_NAME} will reply to you there. Didn't send it? Open the chat again below.`
            : "Our admin can't message you first, so send this. It's how we reach you if anything about your deposit needs checking."}
        </p>
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-line bg-paper px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-ink">
            {message.slice(0, at)}
            <span className="font-mono font-semibold">{refCode}</span>
            {message.slice(at + refCode.length)}
          </p>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 cursor-pointer self-start rounded-lg border border-line-strong px-2.5 py-1 text-[12px] font-semibold text-subtle transition-colors hover:border-orange/40 hover:text-accent-ink sm:self-auto"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <a
          href={`${ADMIN_TELEGRAM_URL}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={open}
          className={
            done
              ? "mt-3 inline-block rounded-xl border border-line-strong bg-card px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-orange/40"
              : "mt-3 inline-block rounded-xl bg-orange px-5 py-2.5 text-[14px] font-semibold text-white shadow-soft transition-colors hover:bg-[#f24e12]"
          }
        >
          Message {ADMIN_DISPLAY_NAME} ↗
        </a>
      </div>
    </div>
  );
}
