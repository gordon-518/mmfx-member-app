"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { computeAnalytics, type JournalAnalytics } from "@/lib/journal/analytics";
import type { LeakResult } from "@/lib/journal/leaks";
import type { Health } from "@/lib/journal/health";
import type { RulesResult } from "@/lib/journal/rules";
import type { Intervention } from "@/lib/journal/interventions";
import type { GameState } from "@/lib/journal/gamification";
import { friendlySyncError } from "@/lib/journal/syncError";
import { InterventionBanner } from "./InterventionBanner";
import { JournalHero } from "./JournalHero";
import { MissionCard } from "./MissionCard";
import { LeaksToBeat } from "./LeaksToBeat";
import { RulesCard } from "./RulesCard";
import { InfoTip } from "./InfoTip";
import { money, pct, fmtTime, fmtDuration } from "./format";
import {
  JOURNAL_EMOTIONS,
  type JournalAccountRow,
  type JournalCashFlowRow,
  type JournalGoalsRow,
  type JournalReportRow,
  type JournalRulesConfig,
  type JournalTradeRow,
} from "@/lib/journal/types";
import { DrawdownChart, EquityCurveChart, PnlHistogram, RadarChart } from "./charts";

// Client half of /journal (Phase 2). Data arrives fully-computed from the server
// component; mutations go through /api/journal/* and re-render via
// router.refresh().

const PAGE_SIZE = 25;

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const STATE_CHIP: Record<string, { label: string; cls: string }> = {
  connecting: { label: "Connecting…", cls: "bg-amber-100 text-amber-800" },
  deployed: { label: "Connected", cls: "bg-accent-soft text-accent-ink" },
  failed: { label: "Connection failed", cls: "bg-red-100 text-red-700" },
};

function AccountCard({ account }: { account: JournalAccountRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"sync" | "disconnect" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const chip = STATE_CHIP[account.state] ?? STATE_CHIP.connecting;

  useEffect(() => {
    if (account.state !== "connecting") return;
    const t = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(t);
  }, [account.state, router]);

  async function syncNow() {
    setBusy("sync");
    setMessage(null);
    try {
      const res = await fetch(`/api/journal/accounts/${account.id}/sync`, {
        method: "POST",
      });
      const body = await res.json();
      setMessage(
        res.ok ? "Sync queued — refreshing shortly." : body.error ?? "Sync failed"
      );
      if (res.ok) setTimeout(() => router.refresh(), 8000);
    } catch {
      setMessage("Network error — please try again");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (
      !window.confirm(
        "Disconnect this account? Your trade history stays in the journal."
      )
    ) {
      return;
    }
    setBusy("disconnect");
    try {
      const res = await fetch(`/api/journal/accounts/${account.id}`, {
        method: "DELETE",
      });
      if (res.ok) router.refresh();
      else setMessage("Could not disconnect — please try again");
    } catch {
      setMessage("Network error — please try again");
    } finally {
      setBusy(null);
    }
  }

  // Member-safe error copy — never leak MetaApi billing / provisioning / DB
  // detail to the card (the raw string stays in the DB for admin debugging).
  const failMsg =
    account.state === "failed" ? friendlySyncError(account.state_detail) : null;
  const syncMsg =
    account.state === "deployed" ? friendlySyncError(account.sync_error) : null;

  return (
    <section className="rise rounded-2xl border border-line bg-card px-5 py-3.5 shadow-soft">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${chip.cls}`}
        >
          {chip.label}
        </span>
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="truncate font-display text-[15px] font-bold text-ink">
            {account.label || `MT5 · ${account.mt5_login}`}
          </h2>
          <span className="hidden truncate text-[13px] text-subtle sm:inline">
            {account.mt5_login} · {account.broker_server}
          </span>
        </div>
        <span className="hidden text-[12px] text-faint md:inline">
          Synced {account.last_synced_at ? fmtTime(account.last_synced_at) : "never"}
        </span>

        <div className="ml-auto flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-faint">Balance</p>
            <p className="font-display text-[15px] font-bold text-ink">
              {money(account.balance, account.currency)}
            </p>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-[10px] uppercase tracking-wide text-faint">Equity</p>
            <p className="font-display text-[15px] font-bold text-ink">
              {money(account.equity, account.currency)}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={syncNow}
              disabled={busy !== null || account.state !== "deployed"}
              className="cursor-pointer rounded-lg bg-orange px-3 py-1.5 text-[12px] font-semibold text-white transition-all hover:bg-[#f24e12] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "sync" ? "Queuing…" : "Sync"}
            </button>
            <button
              onClick={disconnect}
              disabled={busy !== null}
              className="cursor-pointer rounded-lg border border-line-strong bg-card px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50"
            >
              {busy === "disconnect" ? "…" : "Disconnect"}
            </button>
          </div>
        </div>
      </div>

      {account.state === "failed" && failMsg && (
        <p className="mt-2 text-[13px] text-red-600">
          {failMsg.message}{" "}
          <Link href="/journal/connect" className="font-semibold underline">
            Retry
          </Link>
        </p>
      )}
      {syncMsg && (
        <p className="mt-2 text-[13px] text-amber-700">
          {syncMsg.message}
          {syncMsg.canReconnect && (
            <>
              {" "}
              <Link href="/journal/connect" className="font-semibold underline">
                Reconnect
              </Link>
            </>
          )}
        </p>
      )}
      {message && <p className="mt-2 text-[13px] text-subtle">{message}</p>}
    </section>
  );
}

type KpiDelta = { text: string; tone: "up" | "down" | "flat" };

function Kpi({
  label,
  value,
  tone,
  hint,
  info,
  infoAlign,
  delta,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
  hint?: string;
  info?: string;
  infoAlign?: "left" | "right";
  delta?: KpiDelta | null;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-soft">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
        {label}
        {info && <InfoTip text={info} align={infoAlign} />}
      </p>
      <p
        className={`mt-1 font-display text-xl font-bold ${
          tone === "up"
            ? "text-emerald-600"
            : tone === "down"
              ? "text-red-600"
              : "text-ink"
        }`}
      >
        {value}
      </p>
      {delta ? (
        <p className="mt-0.5 text-[11px]">
          <span
            className={`font-bold ${
              delta.tone === "up" ? "text-emerald-600" : delta.tone === "down" ? "text-red-500" : "text-faint"
            }`}
          >
            {delta.text}
          </span>
          <span className="text-faint"> vs prev</span>
        </p>
      ) : hint ? (
        <p className="mt-0.5 text-[11px] text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

// Format a period-over-period change for a KPI. `higherIsBetter` sets the color
// (e.g. a bigger max-drawdown is worse). Returns null when either side is unknown.
function kpiDelta(
  cur: number | null | undefined,
  prev: number | null | undefined,
  kind: "money" | "pct" | "num",
  opts: { higherIsBetter?: boolean; currency?: string | null } = {}
): KpiDelta | null {
  if (cur == null || prev == null) return null;
  const diff = cur - prev;
  const eps = kind === "pct" ? 1e-6 : 0.005;
  if (Math.abs(diff) < eps) return { text: "±0", tone: "flat" };
  const up = diff > 0;
  const higherIsBetter = opts.higherIsBetter ?? true;
  const mag =
    kind === "money"
      ? money(Math.abs(diff), opts.currency ?? undefined)
      : kind === "pct"
        ? `${(Math.abs(diff) * 100).toFixed(1)} pts`
        : Math.abs(diff).toFixed(2);
  return { text: `${up ? "▲" : "▼"} ${mag}`, tone: (up === higherIsBetter ? "up" : "down") };
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-soft">
      <div className="mb-2">
        <h3 className="font-display text-[15px] font-bold text-ink">{title}</h3>
        {subtitle && <p className="text-[12px] text-subtle">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function BreakdownCard({
  title,
  rows,
  currency,
}: {
  title: string;
  rows: { key: string; count: number; netProfit: number; winRate: number }[];
  currency: string | null;
}) {
  // Sorted horizontal bars read faster than a table for "where do I make money".
  const sorted = [...rows].sort((a, b) => b.netProfit - a.netProfit);
  const max = Math.max(1, ...sorted.map((r) => Math.abs(r.netProfit)));
  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-soft">
      <h3 className="mb-2.5 font-display text-[15px] font-bold text-ink">{title}</h3>
      {sorted.length === 0 ? (
        <p className="text-[13px] text-subtle">No trades in this range.</p>
      ) : (
        <div className="space-y-1">
          {sorted.map((r) => {
            const pos = r.netProfit >= 0;
            return (
              <div
                key={r.key}
                className="rounded-lg px-1.5 py-1.5 transition-colors hover:bg-paper/70"
              >
                {/* name + P&L on top — money can be any width without breaking */}
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-display text-[13px] font-semibold text-ink">
                    {r.key}
                  </span>
                  <span
                    className={`shrink-0 font-display text-[13px] font-bold tabular-nums ${
                      r.netProfit > 0 ? "text-emerald-600" : r.netProfit < 0 ? "text-red-500" : "text-ink"
                    }`}
                  >
                    {money(r.netProfit, currency)}
                  </span>
                </div>
                {/* bar + win-rate below */}
                <div className="mt-1 flex items-center gap-2">
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-paper">
                    <div
                      className={`h-full rounded-full ${pos ? "bg-emerald-500/85" : "bg-red-400/85"}`}
                      style={{ width: `${Math.max(3, (Math.abs(r.netProfit) / max) * 100)}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[10.5px] tabular-nums text-faint">
                    {pct(r.winRate)} win
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function NotesEditor({
  trade,
  onSaved,
}: {
  trade: JournalTradeRow;
  onSaved: () => void;
}) {
  const [note, setNote] = useState(trade.note ?? "");
  const [tags, setTags] = useState((trade.tags ?? []).join(", "));
  const [emotion, setEmotion] = useState(trade.emotion ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/journal/trades/${trade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: note || null,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          emotion: emotion || null,
        }),
      });
      if (!res.ok) {
        const b = await res.json();
        setError(b.error ?? "Could not save");
        return;
      }
      onSaved();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-line-strong bg-card px-3 py-2 text-[13px] text-ink focus:border-orange/60 focus:outline-none";

  return (
    <div className="space-y-3 bg-accent-soft/40 p-4">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What happened on this trade? Setup, execution, mistakes…"
        className={`${inputCls} min-h-[64px]`}
        maxLength={2000}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="tags, comma separated (e.g. breakout, london)"
          className={inputCls}
        />
        <select
          value={emotion}
          onChange={(e) => setEmotion(e.target.value)}
          className={inputCls}
        >
          <option value="">How did it feel?</option>
          {JOURNAL_EMOTIONS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-[12px] text-red-600">{error}</p>}
      <button
        onClick={save}
        disabled={busy}
        className="cursor-pointer rounded-lg bg-orange px-4 py-2 text-[13px] font-semibold text-white transition-all hover:bg-[#f24e12] disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save journal"}
      </button>
    </div>
  );
}

const EMOTION_CLS: Record<string, string> = {
  disciplined: "bg-emerald-100 text-emerald-700",
  confident: "bg-emerald-100 text-emerald-700",
  calm: "bg-sky-100 text-sky-700",
  uncertain: "bg-amber-100 text-amber-800",
  fomo: "bg-red-100 text-red-700",
  revenge: "bg-red-100 text-red-700",
  fear: "bg-amber-100 text-amber-800",
  greed: "bg-red-100 text-red-700",
};

function TradesTable({
  trades,
  currency,
}: {
  trades: JournalTradeRow[];
  currency: string | null;
}) {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const pages = Math.max(1, Math.ceil(trades.length / PAGE_SIZE));
  const slice = trades.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <section className="rounded-2xl border border-line bg-card shadow-soft">
      <div className="flex items-center justify-between px-6 pt-5">
        <h2 className="font-display text-lg font-bold text-ink">Trade history</h2>
        {pages > 1 && (
          <div className="flex items-center gap-2 text-[13px] text-subtle">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="cursor-pointer rounded-lg border border-line px-2.5 py-1 disabled:opacity-40"
            >
              ‹
            </button>
            {page + 1} / {pages}
            <button
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={page >= pages - 1}
              className="cursor-pointer rounded-lg border border-line px-2.5 py-1 disabled:opacity-40"
            >
              ›
            </button>
          </div>
        )}
      </div>
      <p className="px-6 pt-1 text-[12px] text-subtle">
        Click a trade to add a note, tags and how it felt.
      </p>
      <div className="mt-3 overflow-x-auto pb-2">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wider text-subtle">
              <th className="px-6 py-2.5 font-semibold">Symbol</th>
              <th className="px-3 py-2.5 font-semibold">Side</th>
              <th className="px-3 py-2.5 font-semibold">Lots</th>
              <th className="px-3 py-2.5 font-semibold">Close</th>
              <th className="px-3 py-2.5 font-semibold">Duration</th>
              <th className="px-3 py-2.5 font-semibold">Journal</th>
              <th className="px-6 py-2.5 text-right font-semibold">Net P&L</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((t) => (
              <Fragment key={t.id}>
                <tr
                  onClick={() => setOpenId(openId === t.id ? null : t.id)}
                  className="cursor-pointer border-b border-line/60 text-ink hover:bg-accent-soft/30"
                >
                  <td className="px-6 py-2.5 font-semibold">{t.symbol}</td>
                  <td
                    className={`px-3 py-2.5 font-semibold uppercase ${
                      t.direction === "buy" ? "text-emerald-600" : "text-red-500"
                    }`}
                  >
                    {t.direction}
                  </td>
                  <td className="px-3 py-2.5">{t.volume}</td>
                  <td className="px-3 py-2.5 text-subtle">
                    {fmtTime(t.close_time)}
                  </td>
                  <td className="px-3 py-2.5 text-subtle">
                    {fmtDuration(t.duration_sec)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5">
                      {t.emotion && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            EMOTION_CLS[t.emotion] ?? "bg-line text-subtle"
                          }`}
                        >
                          {t.emotion}
                        </span>
                      )}
                      {t.note && <span title={t.note}>📝</span>}
                      {!t.emotion && !t.note && (
                        <span className="text-[12px] text-subtle">add…</span>
                      )}
                    </span>
                  </td>
                  <td
                    className={`px-6 py-2.5 text-right font-semibold ${
                      t.net_profit > 0
                        ? "text-emerald-600"
                        : t.net_profit < 0
                          ? "text-red-500"
                          : "text-ink"
                    }`}
                  >
                    {money(t.net_profit, currency)}
                  </td>
                </tr>
                {openId === t.id && (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <NotesEditor
                        trade={t}
                        onSaved={() => {
                          setOpenId(null);
                          router.refresh();
                        }}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  ahead: { label: "Ahead of plan", cls: "bg-emerald-100 text-emerald-700" },
  on_track: { label: "On track", cls: "bg-sky-100 text-sky-700" },
  behind: { label: "Behind plan", cls: "bg-amber-100 text-amber-800" },
  at_risk: { label: "At risk", cls: "bg-red-100 text-red-700" },
};

// Split off the first sentence so the coach can lead with a punchy verdict and
// tuck the rest behind a tap.
function splitFirst(text: string): [string, string] {
  const m = text.match(/^([\s\S]*?[.!?])\s+([\s\S]*)$/);
  return m ? [m[1], m[2]] : [text, ""];
}

function SummaryMore({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      {open && <p className="mt-1.5 text-[14px] leading-relaxed text-ink/80">{text}</p>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-1 cursor-pointer text-[12.5px] font-semibold text-accent-ink hover:underline"
      >
        {open ? "Hide summary ⌃" : "Read full summary ⌄"}
      </button>
    </div>
  );
}

function HabitItem({
  habit,
}: {
  habit: { kind: "good" | "bad"; title: string; detail: string };
}) {
  const [open, setOpen] = useState(false);
  const good = habit.kind === "good";
  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className={`w-full cursor-pointer rounded-xl border p-3 text-left transition-colors ${
        good
          ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100/60"
          : "border-amber-200 bg-amber-50 hover:bg-amber-100/60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`text-[13px] font-semibold ${good ? "text-emerald-800" : "text-amber-800"}`}>
          {habit.title}
        </span>
        <span className={`shrink-0 text-[12px] ${good ? "text-emerald-500" : "text-amber-500"}`}>
          {open ? "⌃" : "⌄"}
        </span>
      </div>
      {open && <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/75">{habit.detail}</p>}
    </button>
  );
}

function CoachCard({
  report,
  reportsRemaining,
  reportCap,
  hasClosedTrades,
}: {
  report: JournalReportRow | null;
  reportsRemaining: number;
  reportCap: number;
  hasClosedTrades: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outOfQuota = reportsRemaining <= 0;

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/journal/report/generate", { method: "POST" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "Could not generate the report");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  }

  const chip = report?.status ? STATUS_CHIP[report.status] : null;

  return (
    <section className="rise rounded-2xl border border-orange/30 bg-accent-soft/30 p-6 shadow-soft sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-display text-[16px] font-bold text-white">
            D
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-ink">Don’s read</h2>
            <p className="text-[12px] text-subtle">
              {report
                ? `AI coach · ${new Date(report.report_date).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                  })}`
                : "AI coach"}
            </p>
          </div>
          {chip && (
            <span
              className={`ml-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${chip.cls}`}
            >
              {chip.label}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={generate}
            disabled={busy || outOfQuota || !hasClosedTrades}
            className="cursor-pointer rounded-xl bg-orange px-4 py-2 text-[13px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy
              ? "Analysing…"
              : !hasClosedTrades
                ? "No closed trades yet"
                : outOfQuota
                  ? "Daily limit reached"
                  : report
                    ? "Regenerate"
                    : "Generate today’s report"}
          </button>
          <span className="text-[11px] text-subtle">
            {reportsRemaining} of {reportCap} left today
          </span>
        </div>
      </div>

      {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}

      {report ? (
        <div className="mt-4 space-y-5">
          <div>
            <p className="text-[16px] font-semibold leading-snug text-ink">
              {splitFirst(report.summary)[0]}
            </p>
            {splitFirst(report.summary)[1] && (
              <SummaryMore text={splitFirst(report.summary)[1]} />
            )}
          </div>

          {report.habits.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {report.habits.some((h) => h.kind === "good") && (
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                    What&apos;s working
                  </p>
                  <div className="space-y-2">
                    {report.habits
                      .filter((h) => h.kind === "good")
                      .map((h, i) => (
                        <HabitItem key={i} habit={h} />
                      ))}
                  </div>
                </div>
              )}
              {report.habits.some((h) => h.kind === "bad") && (
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-amber-700">
                    What&apos;s leaking
                  </p>
                  <div className="space-y-2">
                    {report.habits
                      .filter((h) => h.kind === "bad")
                      .map((h, i) => (
                        <HabitItem key={i} habit={h} />
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {report.tips.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-subtle">
                Do this next
              </p>
              <div className="space-y-2.5">
                {report.tips.map((t, i) => {
                  const [lead, more] = splitFirst(t);
                  return (
                    <div key={i} className="flex gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold text-accent-ink">
                        {i + 1}
                      </span>
                      <p className="text-[13.5px] leading-relaxed text-ink">
                        <span className="font-semibold">{lead}</span>
                        {more ? ` ${more}` : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-[14px] leading-relaxed text-subtle">
          Generate an AI read of your trading — it measures your habits against
          your goals, flags what’s working and what isn’t, and gives concrete
          trade-management tips. Generate one anytime — up to {reportCap} a day.
        </p>
      )}
    </section>
  );
}

function GoalsCard({ goals }: { goals: JournalGoalsRow | null }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">
          Your goals
        </p>
        <Link
          href="/journal/connect?step=goals"
          className="text-[13px] font-semibold text-accent-ink hover:underline"
        >
          {goals ? "Edit" : "Set goals"}
        </Link>
      </div>
      {goals ? (
        <div className="mt-2 space-y-1 text-[14px] text-ink">
          <p>
            {[
              goals.style && `${goals.style} trader`,
              goals.monthly_target_pct != null &&
                `${goals.monthly_target_pct}%/mo target`,
              goals.max_drawdown_pct != null &&
                `${goals.max_drawdown_pct}% max DD`,
              goals.risk_per_trade_pct != null &&
                `${goals.risk_per_trade_pct}% risk/trade`,
            ]
              .filter(Boolean)
              .join(" · ") || "Goals saved"}
          </p>
          {goals.focus_text && (
            <p className="text-[13px] italic text-subtle">“{goals.focus_text}”</p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-[14px] text-subtle">
          Tell the journal what you’re aiming for — the AI coach measures every
          habit against it.
        </p>
      )}
    </section>
  );
}

// --- Performance (date-filterable) ------------------------------------------

type RangeKey = "7d" | "30d" | "90d" | "ytd" | "all" | "custom";
const PRESETS: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "ytd", label: "YTD" },
  { key: "all", label: "All" },
];

function presetStart(key: RangeKey, now: Date): string | null {
  const d = new Date(now);
  if (key === "7d") d.setDate(d.getDate() - 7);
  else if (key === "30d") d.setDate(d.getDate() - 30);
  else if (key === "90d") d.setDate(d.getDate() - 90);
  else if (key === "ytd") return `${now.getFullYear()}-01-01`;
  else return null;
  return d.toISOString().slice(0, 10);
}

function PerformanceSection({
  trades,
  cashFlows,
  currency,
}: {
  trades: JournalTradeRow[];
  cashFlows: JournalCashFlowRow[];
  currency: string | null;
}) {
  const [range, setRange] = useState<RangeKey>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const closed = useMemo(
    () => trades.filter((t) => t.status === "closed" && t.close_time),
    [trades]
  );

  const { fromDate, toDate } = useMemo(() => {
    if (range === "custom") return { fromDate: from || null, toDate: to || null };
    if (range === "all") return { fromDate: null, toDate: null };
    return { fromDate: presetStart(range, new Date()), toDate: null };
  }, [range, from, to]);

  const filtered = useMemo(
    () =>
      closed.filter((t) => {
        const d = (t.close_time as string).slice(0, 10);
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
        return true;
      }),
    [closed, fromDate, toDate]
  );

  const a = useMemo(() => computeAnalytics(filtered, cashFlows), [filtered, cashFlows]);

  // Analytics for the immediately-preceding equal-length window, for ▲/▼ deltas.
  // Only meaningful for the fixed-length presets (not all / ytd / custom).
  const prior = useMemo(() => {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 0;
    if (!days) return null;
    const now = new Date();
    const curStart = new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
    const prevStart = new Date(now.getTime() - 2 * days * 86_400_000).toISOString().slice(0, 10);
    const priorTrades = closed.filter((t) => {
      const d = (t.close_time as string).slice(0, 10);
      return d >= prevStart && d < curStart;
    });
    if (priorTrades.length === 0) return null;
    return computeAnalytics(priorTrades, cashFlows);
  }, [range, closed, cashFlows]);

  const pill = (active: boolean) =>
    `cursor-pointer rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-colors ${
      active ? "bg-ink text-white" : "border border-line-strong text-ink hover:border-orange"
    }`;
  const dateInput =
    "rounded-lg border border-line-strong bg-card px-2 py-1 text-[12px] text-ink focus:border-orange/60 focus:outline-none";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink">Performance</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => setRange(p.key)} className={pill(range === p.key)}>
              {p.label}
            </button>
          ))}
          <button onClick={() => setRange("custom")} className={pill(range === "custom")}>
            Custom
          </button>
          {range === "custom" && (
            <span className="flex items-center gap-1.5">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={dateInput} />
              <span className="text-[12px] text-subtle">→</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={dateInput} />
            </span>
          )}
        </div>
      </div>

      {closed.length === 0 ? (
        <section className="rounded-2xl border border-line bg-card p-6 text-center shadow-soft">
          <p className="text-[14px] text-subtle">
            No closed trades yet — history appears here after the first sync completes.
          </p>
        </section>
      ) : (
        <>
          <p className="-mt-3 text-[12px] text-subtle">
            {filtered.length} closed trade{filtered.length === 1 ? "" : "s"}
            {fromDate ? ` from ${fromDate}` : ""}
            {toDate ? ` to ${toDate}` : range !== "all" && range !== "custom" ? " to today" : ""}
          </p>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Net P&L"
              value={money(a.netProfit, currency)}
              tone={a.netProfit > 0 ? "up" : a.netProfit < 0 ? "down" : undefined}
              hint={`${a.closedCount} closed`}
              delta={kpiDelta(a.netProfit, prior?.netProfit ?? null, "money", { currency })}
              info="Sum of realised profit and loss across the closed trades in this range, after commission and swap."
            />
            <Kpi
              label="Win rate"
              value={pct(a.winRate)}
              delta={kpiDelta(a.winRate, prior?.winRate ?? null, "pct")}
              info="Percentage of the closed trades in this range that finished in profit."
              infoAlign="right"
            />
            <Kpi
              label="Profit factor"
              value={a.profitFactor == null ? "—" : a.profitFactor.toFixed(2)}
              delta={kpiDelta(a.profitFactor, prior?.profitFactor ?? null, "num")}
              info="Gross profit ÷ gross loss. Above 1.0 means your winners outweigh your losers."
            />
            <Kpi
              label="Max drawdown"
              value={money(-a.maxDrawdown, currency)}
              tone={a.maxDrawdown > 0 ? "down" : undefined}
              hint={a.maxDrawdownPct == null ? undefined : pct(a.maxDrawdownPct)}
              delta={kpiDelta(a.maxDrawdown, prior?.maxDrawdown ?? null, "money", { higherIsBetter: false, currency })}
              info="Largest peak-to-trough drop in cumulative P&L over this range."
              infoAlign="right"
            />
            <Kpi
              label="Payoff (R:R)"
              value={a.payoffRatio == null ? "—" : a.payoffRatio.toFixed(2)}
              hint="avg win ÷ avg loss"
              delta={kpiDelta(a.payoffRatio, prior?.payoffRatio ?? null, "num")}
              info="Average winning trade divided by the average losing trade."
            />
            <Kpi
              label="Expectancy"
              value={money(a.expectancy, currency)}
              hint="per trade"
              delta={kpiDelta(a.expectancy, prior?.expectancy ?? null, "money", { currency })}
              info="Average P&L per trade: (win% × avg win) − (loss% × avg loss)."
              infoAlign="right"
            />
            <Kpi
              label="Best / worst"
              value={`${money(a.largestWin, currency)} / ${money(a.largestLoss, currency)}`}
              info="Your single largest winning trade and largest losing trade in this range."
            />
            <Kpi
              label="Streaks"
              value={`${a.longestWinStreak}W · ${a.longestLossStreak}L`}
              hint={
                a.currentStreak === 0
                  ? "no current streak"
                  : `current ${Math.abs(a.currentStreak)}${a.currentStreak > 0 ? "W" : "L"}`
              }
              info="Your longest run of consecutive wins and consecutive losses in this range; the hint shows your current active streak."
              infoAlign="right"
            />
            <Kpi
              label="Avg win / loss"
              value={`${money(a.avgWin, currency)} / ${money(a.avgLoss == null ? null : -a.avgLoss, currency)}`}
              info="Average profit on your winning trades and average loss on your losing trades."
            />
            <Kpi
              label="Avg size"
              value={a.avgLots == null ? "—" : `${a.avgLots} lots`}
              info="Average position size, in lots, across the closed trades in this range."
              infoAlign="right"
            />
            <Kpi
              label="Max exposure"
              value={`${a.maxConcurrentOpen} open`}
              hint="concurrent positions"
              info="The most positions you had open at the same time in this range."
            />
            <Kpi
              label="Avg hold"
              value={fmtDuration(a.avgDurationSec)}
              info="Average time a trade stayed open, from entry to exit."
              infoAlign="right"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Cumulative P&L" subtitle="Closed trades, in order">
              <EquityCurveChart points={a.equityCurve} />
            </ChartCard>
            <ChartCard title="Drawdown" subtitle="Distance below running peak">
              <DrawdownChart points={a.drawdownCurve} />
            </ChartCard>
          </div>

          <ChartCard title="P&L distribution" subtitle="How your winners and losers are spread">
            <PnlHistogram bins={a.pnlHistogram} />
          </ChartCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <BreakdownCard title="By symbol" rows={a.bySymbol} currency={currency} />
            <BreakdownCard title="By session" rows={a.bySession} currency={currency} />
            <BreakdownCard title="By weekday" rows={a.byWeekday} currency={currency} />
          </div>

          {filtered.length > 0 && <TradesTable trades={filtered} currency={currency} />}
        </>
      )}
    </div>
  );
}

function TraderRadar({ analytics, game }: { analytics: JournalAnalytics; game: GameState }) {
  const axes = [
    { label: "Win rate", value: analytics.winRate ?? 0 },
    { label: "Profit", value: Math.min(1, (analytics.profitFactor ?? 0) / 2.5) },
    { label: "R:R", value: Math.min(1, (analytics.payoffRatio ?? 0) / 3) },
    { label: "Discipline", value: (game.score ?? 0) / 100 },
    { label: "Consistency", value: 1 - Math.min(1, analytics.maxDrawdownPct ?? 0) },
  ];
  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-soft">
      <h3 className="font-display text-[15px] font-bold text-ink">Your trading profile</h3>
      <p className="mt-0.5 text-[12px] text-subtle">Five dimensions, one glance</p>
      <div className="mt-1">
        <RadarChart axes={axes} />
      </div>
    </section>
  );
}

// Connected, but the first sync hasn't produced closed trades yet. A branded
// "we're on it" state beats an empty dashboard.
function FirstRunPanel({ connecting }: { connecting: boolean }) {
  return (
    <div className="mt-6 rounded-3xl border border-line bg-card p-8 text-center shadow-soft">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
        <svg
          className={`h-6 w-6 ${connecting ? "animate-spin" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 12a9 9 0 1 1-6.22-8.56" />
        </svg>
      </div>
      <h2 className="mt-4 font-display text-xl font-bold text-ink">
        {connecting ? "Pulling your trading history…" : "No closed trades yet"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-subtle">
        {connecting
          ? "We’re importing your trades from MetaTrader — this can take a few minutes. Your dashboard fills in automatically as they land."
          : "As soon as you close a trade it appears here, and your performance, coach and leaks light up."}
      </p>
      <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-paper" />
        ))}
      </div>
      <Link
        href="/journal/connect?step=goals"
        className="mt-6 inline-block text-[13px] font-semibold text-accent-ink hover:underline"
      >
        Set your goals while you wait →
      </Link>
    </div>
  );
}

export function JournalDashboard({
  accounts,
  trades,
  cashFlows,
  goals,
  analytics,
  leaks,
  health,
  rules,
  rulesConfig,
  interventions,
  game,
  monthNet,
  monthCount,
  profileName,
  report,
  reportsRemaining,
  reportCap,
  currency,
}: {
  accounts: JournalAccountRow[];
  trades: JournalTradeRow[];
  cashFlows: JournalCashFlowRow[];
  goals: JournalGoalsRow | null;
  analytics: JournalAnalytics;
  leaks: LeakResult;
  health: Health;
  rules: RulesResult;
  rulesConfig: JournalRulesConfig;
  interventions: Intervention[];
  game: GameState;
  monthNet: number;
  monthCount: number;
  profileName: string | null;
  report: JournalReportRow | null;
  reportsRemaining: number;
  reportCap: number;
  currency: string | null;
}) {
  const closed = trades.filter((t) => t.status === "closed");
  const open = trades.filter((t) => t.status === "open");

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">
      <InterventionBanner interventions={interventions} />
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
            Trading Journal
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">
            {greeting()}
            {profileName ? `, ${profileName}` : ""}
          </h1>
        </div>
        <p className="shrink-0 text-right text-[12px] text-subtle">
          {accounts[0]?.last_synced_at
            ? `Synced ${fmtTime(accounts[0].last_synced_at)}`
            : "Not synced"}
          <br />
          {closed.length} trades
        </p>
      </div>

      {accounts.length === 0 ? (
        <section className="rise mt-7 rounded-2xl border border-line bg-card p-8 text-center shadow-soft">
          <h2 className="font-display text-xl font-bold text-ink">
            Connect your MT5 account
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-subtle">
            Read-only via your investor password — we can never trade or
            withdraw, and your password is never stored. Your history imports
            automatically.
          </p>
          <Link
            href="/journal/connect"
            className="mt-5 inline-block cursor-pointer rounded-xl bg-orange px-6 py-3 text-[14px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
          >
            Connect MT5
          </Link>
        </section>
      ) : (
        <>
          {/* Account anchor first — which account, how fresh, how much. */}
          <div className="space-y-4">
            {accounts.map((acct) => (
              <AccountCard key={acct.id} account={acct} />
            ))}
          </div>

          {/* First sync pending (no closed trades) → branded loading state. */}
          {closed.length === 0 ? (
            <FirstRunPanel connecting={accounts.some((acct) => acct.state === "connecting")} />
          ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.9fr_1fr] lg:items-start">
            <div className="min-w-0 space-y-6">
              {closed.length > 0 && (
                <JournalHero
                  game={game}
                  health={health}
                  analytics={analytics}
                  monthNet={monthNet}
                  monthCount={monthCount}
                  currency={currency}
                />
              )}

              <PerformanceSection trades={trades} cashFlows={cashFlows} currency={currency} />

              {closed.length > 0 && (
                <RulesCard rules={rules} config={rulesConfig} trades={trades} />
              )}

              {open.length > 0 && (
                <section className="rounded-2xl border border-line bg-card p-5 shadow-soft">
                  <p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">
                    Open positions ({open.length})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {open.map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-[13px] text-ink"
                      >
                        <span
                          className={`font-semibold uppercase ${
                            t.direction === "buy" ? "text-emerald-600" : "text-red-500"
                          }`}
                        >
                          {t.direction}
                        </span>
                        {t.symbol} · {t.volume} lots
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="space-y-6 lg:sticky lg:top-6">
              {closed.length > 0 && <TraderRadar analytics={analytics} game={game} />}
              <CoachCard
                report={report}
                reportsRemaining={reportsRemaining}
                reportCap={reportCap}
                hasClosedTrades={closed.length > 0}
              />
              {closed.length > 0 && (
                <LeaksToBeat leaks={leaks} trades={trades} currency={currency} />
              )}
              {closed.length > 0 && (
                <MissionCard interventions={interventions} game={game} />
              )}
              <GoalsCard goals={goals} />
            </div>
          </div>
          )}
        </>
      )}
    </div>
  );
}
