"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitDeposit, logUpgradeClick, type DepositFormState } from "./actions";
import { ADMIN_TELEGRAM_HANDLE, ADMIN_TELEGRAM_URL, adminDmMessage } from "@/lib/depositRef";

// Deposit submission (conversion-fix 5.1 / 5.4). The primary way to get a
// deposit verified: the member uploads the proof here instead of sending it
// on WhatsApp or Telegram. A paid member uses the same form for a top-up.
//
// Step 1 is messaging @MM_3000 on Telegram. The desk shouldn't message
// members first, so the member opens the chat with their reference code and
// the admin replies there. The app can't see a personal account's DMs, so
// the gate is a required "I've messaged" tick, which opening or copying ticks.

const FIELD =
  "w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[14px] text-ink placeholder:text-faint focus:border-orange/40 focus:outline-none focus:ring-2 focus:ring-orange/15";
const LABEL = "block text-[12.5px] font-semibold text-ink";
const STEP = "text-[11px] font-bold uppercase tracking-[0.12em] text-orange";

const BROKERS = [
  { value: "octa", label: "Octa" },
  { value: "dupoin", label: "Dupoin" },
  { value: "elev8", label: "Elev8" },
] as const;

function SubmitButton({ isTopUp }: { isTopUp: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full cursor-pointer rounded-xl bg-orange px-5 py-3 text-[14px] font-semibold text-white shadow-soft transition-colors hover:bg-[#f24e12] disabled:cursor-wait disabled:opacity-70 sm:w-auto"
    >
      {pending ? "Uploading…" : isTopUp ? "Submit my top-up" : "Submit my deposit"}
    </button>
  );
}

export function DepositSubmitForm({
  defaultBroker,
  tradingview,
  isTopUp,
  refCode,
}: {
  defaultBroker: "octa" | "dupoin" | "elev8";
  tradingview: string | null;
  isTopUp: boolean;
  refCode: string;
}) {
  const [state, action] = useActionState<DepositFormState, FormData>(submitDeposit, null);
  const [messaged, setMessaged] = useState(false);
  const [copied, setCopied] = useState(false);
  const message = adminDmMessage(refCode);

  const openChat = () => {
    setMessaged(true);
    void logUpgradeClick("upgrade_contact_clicked", { channel: "telegram" });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setMessaged(true);
    } catch {
      // Clipboard blocked: the message is on screen to copy by hand.
    }
  };

  if (state && "ok" in state) {
    return (
      <p className="rounded-xl border border-orange/25 bg-accent-soft/40 px-4 py-3 text-[14px] text-ink">
        {`Got it: your $${state.amount.toLocaleString("en-US")} ${isTopUp ? "top-up" : "deposit"} is in for review. We'll reply to your message to @${ADMIN_TELEGRAM_HANDLE} on Telegram and switch your access on as soon as it's verified.`}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <div className="rounded-xl border border-orange/25 bg-accent-soft/30 p-4">
        <p className={STEP}>Step 1</p>
        <p className="mt-1 text-[14.5px] font-semibold text-ink">Message @{ADMIN_TELEGRAM_HANDLE} on Telegram</p>
        <p className="mt-1 text-[13px] leading-relaxed text-subtle">
          Our admin can&apos;t message you first. Send this so we can reach you about your deposit.
        </p>
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-line bg-paper px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-ink">
            {message.slice(0, message.indexOf(refCode))}
            <span className="font-mono font-semibold">{refCode}</span>
            {message.slice(message.indexOf(refCode) + refCode.length)}
          </p>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 cursor-pointer self-start rounded-lg border border-line-strong px-2.5 py-1 text-[12px] font-semibold text-subtle transition-colors hover:border-orange/40 hover:text-accent-ink sm:self-auto"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <a
            href={`${ADMIN_TELEGRAM_URL}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={openChat}
            className="rounded-xl bg-ink px-4 py-2 text-[13px] font-semibold text-paper transition-opacity hover:opacity-90"
          >
            Open @{ADMIN_TELEGRAM_HANDLE} ↗
          </a>
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              required
              checked={messaged}
              onChange={(e) => setMessaged(e.target.checked)}
              className="accent-orange"
            />
            I&apos;ve messaged @{ADMIN_TELEGRAM_HANDLE}
          </label>
        </div>
      </div>

      <div className="space-y-4">
        <p className={STEP}>Step 2 · {isTopUp ? "Your top-up" : "Your deposit"}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className={LABEL}>Broker</span>
            <select name="broker" defaultValue={defaultBroker} required className={FIELD}>
              {BROKERS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className={LABEL}>Trading account number</span>
            <input name="account" inputMode="numeric" pattern="[0-9]{4,20}" required placeholder="e.g. 51234567" className={FIELD} />
          </label>
          <label className="space-y-1.5">
            <span className={LABEL}>{isTopUp ? "Top-up amount (USD)" : "Deposit amount (USD)"}</span>
            <input name="amount" type="number" min="50" step="0.01" required placeholder="50 or more" className={FIELD} />
          </label>
          <label className="space-y-1.5">
            <span className={LABEL}>Telegram username</span>
            <input
              name="telegram"
              required
              pattern="@?[A-Za-z0-9_]{5,32}"
              title="Your Telegram @handle: 5 to 32 letters, numbers or underscores"
              placeholder="@yourhandle"
              autoComplete="off"
              className={FIELD}
            />
          </label>
          <label className="space-y-1.5">
            <span className={LABEL}>
              TradingView username <span className="font-normal text-faint">(optional)</span>
            </span>
            <input name="tradingview" defaultValue={tradingview ?? ""} placeholder="your @handle" className={FIELD} />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className={LABEL}>Screenshot of the deposit</span>
          <input
            name="proof"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            className="block w-full text-[13px] text-subtle file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-accent-ink"
          />
          <span className="block text-[12px] text-faint">
            From your broker&apos;s app or email, showing the amount and your account number. PNG, JPG or WebP, under 10 MB.
          </span>
        </label>
      </div>

      {state && "error" in state && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13.5px] text-red-800">
          {state.error}
        </p>
      )}

      <SubmitButton isTopUp={isTopUp} />
    </form>
  );
}
