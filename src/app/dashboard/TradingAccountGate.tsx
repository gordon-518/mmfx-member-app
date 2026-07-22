"use client";

import { useState, type FormEvent } from "react";
import { validateTradingAccount } from "@/lib/tradingAccount";
import { setTradingAccount } from "./actions";

// Full-screen focused gate for member_active users who haven't saved a trading
// account number yet. They can't reach the desk until they save one — so an
// inactive/switched account never gets an active member removed by mistake.
export function TradingAccountGate() {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const check = validateTradingAccount(value);
    if (!check.ok) { setError(check.message); return; }
    setBusy(true);
    setError("");
    const res = await setTradingAccount(value);
    if (res.ok) {
      window.location.assign("/dashboard");
      return;
    }
    setBusy(false);
    setError(res.error);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-6">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(52rem_44rem_at_27%_16%,#FFEEE2,transparent_70%)]" />
      </div>

      <div className="relative w-full max-w-md rounded-3xl border border-orange/20 bg-card p-7 shadow-soft-lg sm:p-9">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="8" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="2" />
            <path d="M3 11h18" stroke="currentColor" strokeWidth="2" />
            <path d="M7 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>

        <p className="mt-6 text-[13px] font-semibold uppercase tracking-wider text-orange">One more step</p>
        <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-ink">
          Add your trading account number
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-subtle">
          Now that you&apos;re a funded member, link your live MT4/MT5 account
          number. This keeps your access tied to the account you actually trade —
          so an old or inactive account never removes you by mistake.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-faint">
          Switched trading accounts later? Come back and update this to the one
          you&apos;re most active in.
        </p>

        <form onSubmit={onSubmit} className="mt-6">
          <label htmlFor="ta" className="mb-2 block text-sm font-medium text-ink">
            Trading account number
          </label>
          <input
            id="ta"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={value}
            onChange={(e) => { setValue(e.target.value.replace(/\D/g, "").slice(0, 15)); if (error) setError(""); }}
            placeholder="e.g. 51234567"
            className="w-full rounded-xl border border-line bg-card px-3.5 py-3 text-[15px] font-mono tracking-wide text-ink placeholder:font-sans placeholder:text-faint focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/15"
          />
          {error && <p role="alert" className="mt-2.5 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg disabled:cursor-not-allowed disabled:opacity-70"
          >
            {busy ? "Saving…" : "Save & open my desk"}
          </button>
        </form>
      </div>
    </main>
  );
}
