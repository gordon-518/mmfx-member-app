"use client";

import { useState, type FormEvent } from "react";
import { validateTradingAccount } from "@/lib/tradingAccount";
import { setTradingAccount } from "./actions";

// Compact top-of-dashboard bar. Empty → red dot + input + Save. Saved → green dot
// + number + Update (reveals input). Non-blocking; shown to trials and to members
// who already have a number. (Members with no number get the full gate instead.)
export function TradingAccountBar({ current }: { current: string | null }) {
  const [saved, setSaved] = useState<string | null>(current);
  const [editing, setEditing] = useState(!current);
  const [value, setValue] = useState(current ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const check = validateTradingAccount(value);
    if (!check.ok) { setError(check.message); return; }
    setBusy(true);
    setError("");
    const res = await setTradingAccount(value);
    setBusy(false);
    if (res.ok) {
      setSaved(value.trim());
      setEditing(false);
    } else {
      setError(res.error);
    }
  }

  const hasNumber = Boolean(saved);

  return (
    <div className={`rounded-2xl border bg-card p-4 shadow-soft ${hasNumber ? "border-line" : "border-orange/25"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          aria-hidden
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${hasNumber ? "bg-green-500 ring-4 ring-green-500/15" : "bg-red-500 ring-4 ring-red-500/15"}`}
        />
        <div className="min-w-0 flex-1">
          {hasNumber && !editing ? (
            <p className="text-[14px] text-ink">
              <span className="text-subtle">Trading account</span>{" "}
              <span className="font-mono font-bold tracking-wide">{saved}</span>
            </p>
          ) : (
            <p className="text-[14px] font-bold text-ink">Add your trading account number</p>
          )}
          <p className="mt-0.5 text-[12px] leading-snug text-faint">
            {hasNumber && !editing
              ? "Switched trading accounts? Update this to the one you're most active in."
              : "Enter your live MT4/MT5 login. Keep it set to the account you trade most — if the one on file goes inactive you could be removed by mistake."}
          </p>
        </div>

        {editing ? (
          <form onSubmit={onSubmit} className="flex items-center gap-2">
            <input
              inputMode="numeric"
              autoComplete="off"
              value={value}
              onChange={(e) => { setValue(e.target.value.replace(/\D/g, "").slice(0, 15)); if (error) setError(""); }}
              placeholder="e.g. 51234567"
              autoFocus
              className="w-36 rounded-lg border border-line bg-paper/60 px-3 py-2 text-[14px] text-ink placeholder:text-faint focus:border-orange focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-orange px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#f24e12] disabled:opacity-60"
            >
              {busy ? "…" : "Save"}
            </button>
            {hasNumber && (
              <button type="button" onClick={() => { setEditing(false); setValue(saved ?? ""); setError(""); }} className="text-[13px] font-medium text-subtle hover:text-ink">
                Cancel
              </button>
            )}
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-line bg-card px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-paper"
          >
            Update
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-[13px] text-red-600">{error}</p>}
    </div>
  );
}
