"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { JournalGoalsRow } from "@/lib/journal/types";
import { journalApiError } from "@/lib/journal/apiErrors";
import { useT } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { rich } from "@/i18n/rich";

// Two-step connect wizard.
// Step 1 (credentials): posts to /api/journal/accounts. The investor password
// lives only in this form's state and the TLS request — never stored. The
// server name is checked here first, with the same rules the API applies, so
// a wrong or demo server is explained in the reader's language.
// Step 2 (goals): optional, PUT /api/journal/goals; skippable.

type Step = "credentials" | "goals";

const inputCls =
  "w-full rounded-xl border border-line-strong bg-card px-4 py-2.5 text-[14px] text-ink placeholder:text-subtle/70 focus:border-orange/60 focus:outline-none";
const labelCls = "block text-[13px] font-semibold text-ink";
const primaryBtn =
  "cursor-pointer rounded-xl bg-orange px-5 py-3 text-[14px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg disabled:cursor-not-allowed disabled:opacity-50";
import { knownServersFor, validateBrokerServer } from "@/lib/journal/brokerServers";

const secondaryBtn =
  "cursor-pointer rounded-xl border border-line-strong bg-card px-4 py-2.5 text-[14px] font-semibold text-ink transition-colors hover:border-orange/40 hover:text-accent-ink";

function CredentialsStep({
  tradingAccountNumber,
  brokers,
  onDone,
}: {
  tradingAccountNumber: string | null;
  brokers: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [brokerId, setBrokerId] = useState("");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState("");
  const [label, setLabel] = useState("");
  // The servers this broker really runs, offered in the dropdown. The list
  // isn't exhaustive, so "Other" lets a member type theirs (22 Sep).
  const servers = knownServersFor(brokerId);
  const [typingServer, setTypingServer] = useState(false);
  const showServerInput = typingServer || servers.length === 0;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const T = useT();
  const c = T.journalConnect;

  if (!tradingAccountNumber) {
    return <p className="text-[14px] text-ink">{c.noAccountNumber}</p>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const checked = validateBrokerServer(server, brokerId, c.serverErrors);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/journal/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broker_id: brokerId, password, server, label }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(journalApiError(res.status, body, T.journal.errors, c.connectFailed));
        return;
      }
      onDone();
    } catch {
      setError(T.journal.networkError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={labelCls}>{c.accountNumber}</label>
        <input
          className={`${inputCls} mt-1.5 bg-canvas/60`}
          value={tradingAccountNumber}
          readOnly
          aria-readonly
        />
        <p className="mt-1.5 text-[12px] text-subtle">{c.accountNumberHelp}</p>
      </div>
      <div>
        <label className={labelCls} htmlFor="mt5-broker">
          {c.broker}
        </label>
        <select
          id="mt5-broker"
          className={`${inputCls} mt-1.5`}
          value={brokerId}
          onChange={(e) => {
            setBrokerId(e.target.value);
            setServer("");
            setTypingServer(false);
          }}
          required
        >
          <option value="" disabled>
            {c.chooseBroker}
          </option>
          {brokers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor="mt5-password">
          {c.password}
        </label>
        <input
          id="mt5-password"
          className={`${inputCls} mt-1.5`}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={c.passwordPlaceholder}
          required
        />
        <p className="mt-1.5 text-[12px] leading-relaxed text-subtle">
          {rich(c.passwordHelp, { neverStored: <span className="font-semibold">{c.neverStored}</span> })}
        </p>
      </div>
      <div>
        <label className={labelCls} htmlFor="mt5-server">
          {c.server}
        </label>
        {/* The servers this broker runs (brokerServers.ts), with "Other" for
            anyone on one we haven't listed. The API checks the same rules and
            refuses demo servers either way. */}
        {servers.length > 0 && (
          <select
            id="mt5-server"
            className={`${inputCls} mt-1.5`}
            value={showServerInput ? "__other" : server}
            onChange={(e) => {
              if (e.target.value === "__other") {
                setTypingServer(true);
                setServer("");
              } else {
                setTypingServer(false);
                setServer(e.target.value);
              }
            }}
            required={!showServerInput}
          >
            <option value="" disabled>
              {c.chooseServer}
            </option>
            {servers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="__other">{c.otherServer}</option>
          </select>
        )}
        {showServerInput && (
          <input
            id={servers.length > 0 ? "mt5-server-other" : "mt5-server"}
            className={`${inputCls} mt-1.5`}
            value={server}
            onChange={(e) => setServer(e.target.value)}
            placeholder={
              servers.length > 0 ? fmt(c.serverExample, { example: servers[0] }) : c.serverPlaceholder
            }
            autoFocus={servers.length > 0}
            required
          />
        )}
        <p className="mt-1.5 text-[12px] leading-relaxed text-subtle">
          {rich(c.serverHelp, {
            other: <span className="font-semibold">{c.other}</span>,
            liveOnly: <span className="font-semibold">{c.liveOnly}</span>,
          })}
        </p>
      </div>
      <div>
        <label className={labelCls} htmlFor="mt5-label">
          {c.nickname} <span className="font-normal text-subtle">{c.optional}</span>
        </label>
        <input
          id="mt5-label"
          className={`${inputCls} mt-1.5`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={c.nicknamePlaceholder}
          maxLength={60}
        />
      </div>
      {error && <p className="text-[13px] text-red-600">{error}</p>}
      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? c.connecting : c.connect}
        </button>
        <Link href="/journal" className="text-[13px] text-subtle hover:underline">
          {T.common.cancel}
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
  const T = useT();
  const g = T.journalConnect.goals;

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
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(journalApiError(res.status, body, T.journal.errors, g.saveFailed));
        return;
      }
      router.push("/journal");
    } catch {
      setError(T.journal.networkError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={labelCls} htmlFor="goal-style">
          {g.style}
        </label>
        <select
          id="goal-style"
          className={`${inputCls} mt-1.5`}
          value={style}
          onChange={(e) => setStyle(e.target.value)}
        >
          <option value="">{g.select}</option>
          <option value="scalper">{g.styles.scalper}</option>
          <option value="day">{g.styles.day}</option>
          <option value="swing">{g.styles.swing}</option>
          <option value="position">{g.styles.position}</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls} htmlFor="goal-size">
            {g.accountSize}
          </label>
          <input
            id="goal-size"
            className={`${inputCls} mt-1.5`}
            value={accountSize}
            onChange={(e) => setAccountSize(e.target.value)}
            placeholder={g.accountSizePlaceholder}
            inputMode="decimal"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="goal-target">
            {g.target}
          </label>
          <input
            id="goal-target"
            className={`${inputCls} mt-1.5`}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={g.targetPlaceholder}
            inputMode="decimal"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="goal-dd">
            {g.maxDd}
          </label>
          <input
            id="goal-dd"
            className={`${inputCls} mt-1.5`}
            value={maxDd}
            onChange={(e) => setMaxDd(e.target.value)}
            placeholder={g.maxDdPlaceholder}
            inputMode="decimal"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="goal-risk">
            {g.risk}
          </label>
          <input
            id="goal-risk"
            className={`${inputCls} mt-1.5`}
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
            placeholder={g.riskPlaceholder}
            inputMode="decimal"
          />
        </div>
      </div>
      <div>
        <label className={labelCls} htmlFor="goal-instruments">
          {g.instruments}
        </label>
        <input
          id="goal-instruments"
          className={`${inputCls} mt-1.5`}
          value={instruments}
          onChange={(e) => setInstruments(e.target.value)}
          placeholder={g.instrumentsPlaceholder}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="goal-focus">
          {g.focus}
        </label>
        <textarea
          id="goal-focus"
          className={`${inputCls} mt-1.5 min-h-[90px]`}
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder={g.focusPlaceholder}
          maxLength={2000}
        />
        <p className="mt-1.5 text-[12px] text-subtle">{g.focusHelp}</p>
      </div>
      {error && <p className="text-[13px] text-red-600">{error}</p>}
      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? T.common.saving : g.save}
        </button>
        <Link href="/journal" className={secondaryBtn}>
          {g.skip}
        </Link>
      </div>
    </form>
  );
}

export function ConnectWizard({
  initialStep,
  initialGoals,
  tradingAccountNumber,
  brokers,
}: {
  initialStep: Step;
  initialGoals: JournalGoalsRow | null;
  tradingAccountNumber: string | null;
  brokers: { id: string; name: string }[];
}) {
  const [step, setStep] = useState<Step>(initialStep);
  const credentialsFirst = initialStep === "credentials";
  const c = useT().journalConnect;

  return (
    <div className="mx-auto max-w-xl px-5 py-8 sm:px-8 lg:py-10">
      <div className="rise">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">{c.eyebrow}</p>
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">
          {step === "credentials" ? c.titleConnect : c.titleGoals}
        </h1>
        {credentialsFirst && (
          <p className="mt-2 text-[13px] font-semibold text-subtle">
            {fmt(c.stepOf, { n: step === "credentials" ? 1 : 2 })}
          </p>
        )}
        <p className="mt-2 text-[15px] leading-relaxed text-subtle">
          {step === "credentials" ? c.subConnect : c.subGoals}
        </p>
      </div>

      <section className="rise mt-7 rounded-2xl border border-line bg-card p-6 shadow-soft sm:p-7">
        {step === "credentials" ? (
          <CredentialsStep
            tradingAccountNumber={tradingAccountNumber}
            brokers={brokers}
            onDone={() => setStep("goals")}
          />
        ) : (
          <GoalsStep initial={initialGoals} />
        )}
      </section>
    </div>
  );
}
