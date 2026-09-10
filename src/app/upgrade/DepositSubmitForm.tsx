"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitDeposit, type DepositFormState } from "./actions";

// Deposit submission (conversion-fix 5.1 / 5.4). The primary way to get a
// deposit verified: the member uploads the proof here instead of sending it
// on WhatsApp or Telegram. A paid member uses the same form for a top-up.

const FIELD =
  "w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[14px] text-ink placeholder:text-faint focus:border-orange/40 focus:outline-none focus:ring-2 focus:ring-orange/15";
const LABEL = "block text-[12.5px] font-semibold text-ink";

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
}: {
  defaultBroker: "octa" | "dupoin" | "elev8";
  tradingview: string | null;
  isTopUp: boolean;
}) {
  const [state, action] = useActionState<DepositFormState, FormData>(submitDeposit, null);

  if (state && "ok" in state) {
    return (
      <p className="rounded-xl border border-orange/25 bg-accent-soft/40 px-4 py-3 text-[14px] text-ink">
        {`Got it: your $${state.amount.toLocaleString("en-US")} ${isTopUp ? "top-up" : "deposit"} is in for review. We'll switch your access on as soon as it's verified.`}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
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

      {state && "error" in state && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13.5px] text-red-800">
          {state.error}
        </p>
      )}

      <SubmitButton isTopUp={isTopUp} />
    </form>
  );
}
