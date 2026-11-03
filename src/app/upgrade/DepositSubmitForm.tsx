"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitDeposit, type DepositFormState } from "./actions";
import { AmeliaLastStep } from "./AmeliaLastStep";
import { ADMIN_DISPLAY_NAME } from "@/lib/depositRef";
import { useT } from "@/i18n/client";
import { fmt } from "@/i18n/format";

// Deposit submission (conversion-fix 5.1 / 5.4). The primary way to get a
// deposit verified: the member uploads the proof here instead of sending it
// on WhatsApp or Telegram. A paid member uses the same form for a top-up.
//
// The form comes first (Gordon, 15 Sep). Once it's in, the last step is
// messaging Admin Amelia (@MM_3000) on Telegram, because the desk shouldn't
// message members first: see <AmeliaLastStep>. Messaging after submitting
// means Amelia already has the details, and the message carries the amount.

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
  const f = useT().upgrade.form;
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full cursor-pointer rounded-xl bg-orange px-5 py-3 text-[14px] font-semibold text-white shadow-soft transition-colors hover:bg-[#f24e12] disabled:cursor-wait disabled:opacity-70 sm:w-auto"
    >
      {pending ? f.uploading : isTopUp ? f.submitTopUp : f.submitDeposit}
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
  const f = useT().upgrade.form;

  if (state && "ok" in state) {
    return (
      <AmeliaLastStep
        refCode={refCode}
        amount={state.amount}
        isTopUp={isTopUp}
        clicked={false}
        broker={state.broker}
        account={state.account}
      />
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className={LABEL}>{f.broker}</span>
          <select name="broker" defaultValue={defaultBroker} required className={FIELD}>
            {BROKERS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className={LABEL}>{f.account}</span>
          <input name="account" inputMode="numeric" pattern="[0-9]{4,20}" required placeholder={f.accountPlaceholder} className={FIELD} />
        </label>
        <label className="space-y-1.5">
          <span className={LABEL}>{isTopUp ? f.amountTopUp : f.amount}</span>
          <input name="amount" type="number" min="50" step="0.01" required placeholder={f.amountPlaceholder} className={FIELD} />
        </label>
        <label className="space-y-1.5">
          <span className={LABEL}>{f.telegram}</span>
          <input
            name="telegram"
            required
            pattern="@?[A-Za-z0-9_]{5,32}"
            title={f.telegramTitle}
            placeholder={f.telegramPlaceholder}
            autoComplete="off"
            className={FIELD}
          />
        </label>
        <label className="space-y-1.5">
          <span className={LABEL}>
            {f.tradingview} <span className="font-normal text-faint">{f.optional}</span>
          </span>
          <input name="tradingview" defaultValue={tradingview ?? ""} placeholder={f.tradingviewPlaceholder} className={FIELD} />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className={LABEL}>{f.screenshot}</span>
        <input
          name="proof"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required
          className="block w-full text-[13px] text-subtle file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-accent-ink"
        />
        <span className="block text-[12px] text-faint">{f.screenshotHint}</span>
      </label>

      {state && "error" in state && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13.5px] text-red-800">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:gap-4">
        <SubmitButton isTopUp={isTopUp} />
        <p className="text-[12.5px] text-faint">{fmt(f.nextAdmin, { admin: ADMIN_DISPLAY_NAME })}</p>
      </div>
    </form>
  );
}
