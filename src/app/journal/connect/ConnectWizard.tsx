"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { JournalGoalsRow } from "@/lib/journal/types";

// Two-step connect wizard.
// Step 1 (credentials): posts to /api/journal/accounts. The investor password
// lives only in this form's state and the TLS request — never stored.
// Step 2 (goals): optional, PUT /api/journal/goals; skippable.

type Step = "credentials" | "goals";

const inputCls =
  "w-full rounded-xl border border-line-strong bg-card px-4 py-2.5 text-[14px] text-ink placeholder:text-subtle/70 focus:border-orange/60 focus:outline-none";
const labelCls = "block text-[13px] font-semibold text-ink";
const primaryBtn =
  "cursor-pointer rounded-xl bg-orange px-5 py-3 text-[14px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg disabled:cursor-not-allowed disabled:opacity-50";
const secondaryBtn =
  "cursor-pointer rounded-xl border border-line-strong bg-card px-4 py-2.5 text-[14px] font-semibold text-ink transition-colors hover:border-orange/40 hover:text-accent-ink";

function CredentialsStep({ onDone }: { onDone: () => void }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/journal/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password, server, label }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Connection failed — please try again");
        return;
      }
      onDone();
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={labelCls} htmlFor="mt5-login">
          MT5 account number
        </label>
        <input
          id="mt5-login"
          className={`${inputCls} mt-1.5`}
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="e.g. 51234567"
          inputMode="numeric"
          required
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="mt5-password">
          Investor password (read-only)
        </label>
        <input
          id="mt5-password"
          className={`${inputCls} mt-1.5`}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your investor password — not the master password"
          required
        />
        <p className="mt-1.5 text-[12px] leading-relaxed text-subtle">
          The investor password only allows viewing — no trading, no
          withdrawals. It is passed securely to our sync provider and{" "}
          <span className="font-semibold">never stored</span>. Find it in MT5
          under Settings → Change password, or ask your broker.
        </p>
      </div>
      <div>
        <label className={labelCls} htmlFor="mt5-server">
          Broker server
        </label>
        <input
          id="mt5-server"
          className={`${inputCls} mt-1.5`}
          value={server}
          onChange={(e) => setServer(e.target.value)}
          placeholder="e.g. OctaFX-Real (shown on your MT5 login screen)"
          required
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="mt5-label">
          Nickname <span className="font-normal text-subtle">(optional)</span>
        </label>
        <input
          id="mt5-label"
          className={`${inputCls} mt-1.5`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Main account"
          maxLength={60}
        />
      </div>
      {error && <p className="text-[13px] text-red-600">{error}</p>}
      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? "Connecting…" : "Connect account"}
        </button>
        <Link href="/journal" className="text-[13px] text-subtle hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function GoalsStep({ initial }: { initial: JournalGoalsRow | null }) {
  const router = useRouter();
  const [style, setStyle] = useState(initial?.style ?? "");
  const [accountSize, setAccountSize] = useState(
    initial?.account_size?.toString() ?? ""
  );
  const [target, setTarget] = useState(
    initial?.monthly_target_pct?.toString() ?? ""
  );
  const [maxDd, setMaxDd] = useState(
    initial?.max_drawdown_pct?.toString() ?? ""
  );
  const [risk, setRisk] = useState(
    initial?.risk_per_trade_pct?.toString() ?? ""
  );
  const [instruments, setInstruments] = useState(
    initial?.instruments?.join(", ") ?? ""
  );
  const [focus, setFocus] = useState(initial?.focus_text ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));
    try {
      const res = await fetch("/api/journal/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style: style || null,
          account_size: numOrNull(accountSize),
          monthly_target_pct: numOrNull(target),
          max_drawdown_pct: numOrNull(maxDd),
          risk_per_trade_pct: numOrNull(risk),
          instruments: instruments
            .split(",")
            .map((i) => i.trim())
            .filter(Boolean),
          focus_text: focus || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not save goals");
        return;
      }
      router.push("/journal");
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={labelCls} htmlFor="goal-style">
          Trading style
        </label>
        <select
          id="goal-style"
          className={`${inputCls} mt-1.5`}
          value={style}
          onChange={(e) => setStyle(e.target.value)}
        >
          <option value="">Select…</option>
          <option value="scalper">Scalper (minutes)</option>
          <option value="day">Day trader (hours)</option>
          <option value="swing">Swing trader (days)</option>
          <option value="position">Position trader (weeks+)</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls} htmlFor="goal-size">
            Account size
          </label>
          <input
            id="goal-size"
            className={`${inputCls} mt-1.5`}
            value={accountSize}
            onChange={(e) => setAccountSize(e.target.value)}
            placeholder="e.g. 10000"
            inputMode="decimal"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="goal-target">
            Monthly target %
          </label>
          <input
            id="goal-target"
            className={`${inputCls} mt-1.5`}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="e.g. 5"
            inputMode="decimal"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="goal-dd">
            Max drawdown %
          </label>
          <input
            id="goal-dd"
            className={`${inputCls} mt-1.5`}
            value={maxDd}
            onChange={(e) => setMaxDd(e.target.value)}
            placeholder="e.g. 10"
            inputMode="decimal"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="goal-risk">
            Risk per trade %
          </label>
          <input
            id="goal-risk"
            className={`${inputCls} mt-1.5`}
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
            placeholder="e.g. 1"
            inputMode="decimal"
          />
        </div>
      </div>
      <div>
        <label className={labelCls} htmlFor="goal-instruments">
          Instruments you trade
        </label>
        <input
          id="goal-instruments"
          className={`${inputCls} mt-1.5`}
          value={instruments}
          onChange={(e) => setInstruments(e.target.value)}
          placeholder="e.g. XAUUSD, EURUSD"
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="goal-focus">
          What are you working on right now?
        </label>
        <textarea
          id="goal-focus"
          className={`${inputCls} mt-1.5 min-h-[90px]`}
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder="e.g. Stop moving my stop loss. Stick to London session only."
          maxLength={2000}
        />
        <p className="mt-1.5 text-[12px] text-subtle">
          The AI coach reads this — the more honest, the sharper its feedback.
        </p>
      </div>
      {error && <p className="text-[13px] text-red-600">{error}</p>}
      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? "Saving…" : "Save goals"}
        </button>
        <Link href="/journal" className={secondaryBtn}>
          Skip for now
        </Link>
      </div>
    </form>
  );
}

export function ConnectWizard({
  initialStep,
  initialGoals,
}: {
  initialStep: Step;
  initialGoals: JournalGoalsRow | null;
}) {
  const [step, setStep] = useState<Step>(initialStep);
  const credentialsFirst = initialStep === "credentials";

  return (
    <div className="mx-auto max-w-xl px-5 py-8 sm:px-8 lg:py-10">
      <div className="rise">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
          Trading Journal · Setup
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">
          {step === "credentials" ? "Connect your MT5" : "Set your goals"}
        </h1>
        {credentialsFirst && (
          <p className="mt-2 text-[13px] font-semibold text-subtle">
            Step {step === "credentials" ? "1" : "2"} of 2
          </p>
        )}
        <p className="mt-2 text-[15px] leading-relaxed text-subtle">
          {step === "credentials"
            ? "Read-only access via your investor password. Trades import automatically — usually within a few minutes."
            : "The journal measures every stat and habit against what YOU are trying to achieve."}
        </p>
      </div>

      <section className="rise mt-7 rounded-2xl border border-line bg-card p-6 shadow-soft sm:p-7">
        {step === "credentials" ? (
          <CredentialsStep onDone={() => setStep("goals")} />
        ) : (
          <GoalsStep initial={initialGoals} />
        )}
      </section>
    </div>
  );
}
