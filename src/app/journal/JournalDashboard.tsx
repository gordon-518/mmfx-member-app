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
import { journalApiError } from "@/lib/journal/apiErrors";
import {
  directionLabel,
  emotionLabel,
  sessionLabel,
  styleLabel,
  weekdayLabel,
} from "@/lib/journal/labels";
import { useLocale, useT } from "@/i18n/client";
import { INTL_LOCALE } from "@/i18n/config";
import { fmt, plural } from "@/i18n/format";
import type { Messages } from "@/i18n/messages/types";
import { InterventionBanner } from "./InterventionBanner";
import { JournalHero } from "./JournalHero";
import { MissionCard } from "./MissionCard";
import { LeaksToBeat } from "./LeaksToBeat";
import { RulesCard } from "./RulesCard";
import { InfoTip } from "./InfoTip";
import { money, pct, fmtDay, fmtTime, fmtDuration, profitFactorLabel, splitFirst } from "./format";
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
// router.refresh(). Words come from the journal dictionaries; the reader's
// locale also picks the date format (INTL_LOCALE).

type J = Messages["journal"];

const PAGE_SIZE = 25;

function greeting(g: J["greeting"]): string {
  const h = new Date().getHours();
  return h < 12 ? g.morning : h < 18 ? g.afternoon : g.evening;
}

const STATE_CHIP: Record<string, { key: keyof J["state"]; cls: string }> = {
  connecting: { key: "connecting", cls: "bg-amber-100 text-amber-800" },
  deployed: { key: "deployed", cls: "bg-accent-soft text-accent-ink" },
  failed: { key: "failed", cls: "bg-red-100 text-red-700" },
};

function AccountCard({ account }: { account: JournalAccountRow }) {
  const T = useT();
  const j = T.journal;
  const intl = INTL_LOCALE[useLocale()];
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
      const body = await res.json().catch(() => ({}));
      setMessage(
        res.ok
          ? j.account.syncQueued
          : journalApiError(res.status, body, j.errors, j.account.syncFailed)
      );
      if (res.ok) setTimeout(() => router.refresh(), 8000);
    } catch {
      setMessage(j.networkError);
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (!window.confirm(j.account.disconnectConfirm)) {
      return;
    }
    setBusy("disconnect");
    try {
      const res = await fetch(`/api/journal/accounts/${account.id}`, {
        method: "DELETE",
      });
      if (res.ok) router.refresh();
      else setMessage(j.account.disconnectFailed);
    } catch {
      setMessage(j.networkError);
    } finally {
      setBusy(null);
    }
  }

  // Member-safe error copy — never leak MetaApi billing / provisioning / DB
  // detail to the card (the raw string stays in the DB for admin debugging).
  const failMsg =
    account.state === "failed" ? friendlySyncError(account.state_detail, T.journalEngine) : null;
  const syncMsg =
    account.state === "deployed" ? friendlySyncError(account.sync_error, T.journalEngine) : null;

  return (
    <section className="rise rounded-2xl border border-line bg-card px-5 py-3.5 shadow-soft">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${chip.cls}`}
        >
          {j.state[chip.key]}
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
          {account.last_synced_at
            ? fmt(j.synced, { time: fmtTime(account.last_synced_at, intl) })
            : j.syncedNever}
        </span>

        <div className="ml-auto flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-faint">{j.account.balance}</p>
            <p className="font-display text-[15px] font-bold text-ink">
              {money(account.balance, account.currency)}
            </p>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-[10px] uppercase tracking-wide text-faint">{j.account.equity}</p>
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
              {busy === "sync" ? j.account.queuing : j.account.sync}
            </button>
            <button
              onClick={disconnect}
              disabled={busy !== null}
              className="cursor-pointer rounded-lg border border-line-strong bg-card px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50"
            >
              {busy === "disconnect" ? "…" : j.account.disconnect}
            </button>
          </div>
        </div>
      </div>

      {account.state === "failed" && failMsg && (
        <p className="mt-2 text-[13px] text-red-600">
          {failMsg.message}{" "}
          <Link href="/journal/connect" className="font-semibold underline">
            {j.account.retry}
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
                {j.account.reconnect}
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
  const vsPrev = useT().journal.kpi.vsPrev;
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
          <span className="text-faint"> {vsPrev}</span>
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
  opts: { higherIsBetter?: boolean; currency?: string | null; pts?: string } = {}
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
        ? fmt(opts.pts ?? "{n} pts", { n: (Math.abs(diff) * 100).toFixed(1) })
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
  label = (key) => key,
}: {
  title: string;
  rows: { key: string; count: number; netProfit: number; winRate: number }[];
  currency: string | null;
  /** The row's name in the reader's language (session and weekday keys are data). */
  label?: (key: string) => string;
}) {
  const c = useT().journal.charts;
  // Sorted horizontal bars read faster than a table for "where do I make money".
  const sorted = [...rows].sort((a, b) => b.netProfit - a.netProfit);
  const max = Math.max(1, ...sorted.map((r) => Math.abs(r.netProfit)));
  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-soft">
      <h3 className="mb-2.5 font-display text-[15px] font-bold text-ink">{title}</h3>
      {sorted.length === 0 ? (
        <p className="text-[13px] text-subtle">{c.noTradesInRange}</p>
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
                    {label(r.key)}
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
                    {fmt(c.winShare, { pct: pct(r.winRate) })}
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
  const T = useT();
  const j = T.journal;

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
        const b = await res.json().catch(() => ({}));
        setError(journalApiError(res.status, b, j.errors, j.trades.saveFailed));
        return;
      }
      onSaved();
    } catch {
      setError(j.networkError);
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
        placeholder={j.trades.notePlaceholder}
        className={`${inputCls} min-h-[64px]`}
        maxLength={2000}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={j.trades.tagsPlaceholder}
          className={inputCls}
        />
        <select
          value={emotion}
          onChange={(e) => setEmotion(e.target.value)}
          className={inputCls}
        >
          <option value="">{j.trades.howFelt}</option>
          {JOURNAL_EMOTIONS.map((e) => (
            <option key={e} value={e}>
              {emotionLabel(e, T.journalEngine)}
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
        {busy ? T.common.saving : j.trades.save}
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
  const T = useT();
  const j = T.journal;
  const intl = INTL_LOCALE[useLocale()];
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const pages = Math.max(1, Math.ceil(trades.length / PAGE_SIZE));
  const slice = trades.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <section className="rounded-2xl border border-line bg-card shadow-soft">
      <div className="flex items-center justify-between px-6 pt-5">
        <h2 className="font-display text-lg font-bold text-ink">{j.trades.title}</h2>
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
      <p className="px-6 pt-1 text-[12px] text-subtle">{j.trades.hint}</p>
      <div className="mt-3 overflow-x-auto pb-2">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wider text-subtle">
              <th className="px-6 py-2.5 font-semibold">{j.trades.symbol}</th>
              <th className="px-3 py-2.5 font-semibold">{j.trades.side}</th>
              <th className="px-3 py-2.5 font-semibold">{j.trades.lots}</th>
              <th className="px-3 py-2.5 font-semibold">{j.trades.close}</th>
              <th className="px-3 py-2.5 font-semibold">{j.trades.duration}</th>
              <th className="px-3 py-2.5 font-semibold">{j.trades.journal}</th>
              <th className="px-6 py-2.5 text-right font-semibold">{j.trades.netPnl}</th>
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
                    {directionLabel(t.direction, T.journalEngine)}
                  </td>
                  <td className="px-3 py-2.5">{t.volume}</td>
                  <td className="px-3 py-2.5 text-subtle">
                    {fmtTime(t.close_time, intl)}
                  </td>
                  <td className="px-3 py-2.5 text-subtle">
                    {fmtDuration(t.duration_sec, j.durations)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5">
                      {t.emotion && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            EMOTION_CLS[t.emotion] ?? "bg-line text-subtle"
                          }`}
                        >
                          {emotionLabel(t.emotion, T.journalEngine)}
                        </span>
                      )}
                      {t.note && <span title={t.note}>📝</span>}
                      {!t.emotion && !t.note && (
                        <span className="text-[12px] text-subtle">{j.trades.add}</span>
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

const STATUS_CHIP: Record<string, { key: keyof J["coach"]["status"]; cls: string }> = {
  ahead: { key: "ahead", cls: "bg-emerald-100 text-emerald-700" },
  on_track: { key: "on_track", cls: "bg-sky-100 text-sky-700" },
  behind: { key: "behind", cls: "bg-amber-100 text-amber-800" },
  at_risk: { key: "at_risk", cls: "bg-red-100 text-red-700" },
};

function SummaryMore({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const c = useT().journal.coach;
  return (
    <div>
      {open && <p className="mt-1.5 text-[14px] leading-relaxed text-ink/80">{text}</p>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-1 cursor-pointer text-[12.5px] font-semibold text-accent-ink hover:underline"
      >
        {open ? c.hideSummary : c.readSummary}
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
  const T = useT();
  const j = T.journal;
  const c = j.coach;
  const intl = INTL_LOCALE[useLocale()];
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
        setError(journalApiError(res.status, b, j.errors, c.failed, { cap: reportCap }));
        return;
      }
      router.refresh();
    } catch {
      setError(j.networkError);
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
            <h2 className="font-display text-lg font-bold text-ink">{c.title}</h2>
            <p className="text-[12px] text-subtle">
              {report ? fmt(c.aiCoachOn, { date: fmtDay(report.report_date, intl) }) : c.aiCoach}
            </p>
          </div>
          {chip && (
            <span
              className={`ml-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${chip.cls}`}
            >
              {c.status[chip.key]}
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
              ? c.analysing
              : !hasClosedTrades
                ? c.noClosed
                : outOfQuota
                  ? c.limitReached
                  : report
                    ? c.regenerate
                    : c.generate}
          </button>
          <span className="text-[11px] text-subtle">
            {fmt(c.leftToday, { n: reportsRemaining, cap: reportCap })}
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
                    {c.working}
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
                    {c.leaking}
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
                {c.next}
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
        <p className="mt-3 text-[14px] leading-relaxed text-subtle">{fmt(c.empty, { cap: reportCap })}</p>
      )}
    </section>
  );
}

function GoalsCard({ goals }: { goals: JournalGoalsRow | null }) {
  const T = useT();
  const g = T.journal.goals;
  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">{g.title}</p>
        <Link
          href="/journal/connect?step=goals"
          className="text-[13px] font-semibold text-accent-ink hover:underline"
        >
          {goals ? g.edit : g.set}
        </Link>
      </div>
      {goals ? (
        <div className="mt-2 space-y-1 text-[14px] text-ink">
          <p>
            {[
              goals.style && styleLabel(goals.style, T.journalEngine),
              goals.monthly_target_pct != null && fmt(g.target, { n: goals.monthly_target_pct }),
              goals.max_drawdown_pct != null && fmt(g.maxDd, { n: goals.max_drawdown_pct }),
              goals.risk_per_trade_pct != null && fmt(g.risk, { n: goals.risk_per_trade_pct }),
            ]
              .filter(Boolean)
              .join(" · ") || g.saved}
          </p>
          {goals.focus_text && (
            <p className="text-[13px] italic text-subtle">“{goals.focus_text}”</p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-[14px] text-subtle">{g.empty}</p>
      )}
    </section>
  );
}

// --- Performance (date-filterable) ------------------------------------------

type RangeKey = "7d" | "30d" | "90d" | "ytd" | "all" | "custom";
const PRESETS: { key: RangeKey; label: keyof J["performance"]["presets"] }[] = [
  { key: "7d", label: "d7" },
  { key: "30d", label: "d30" },
  { key: "90d", label: "d90" },
  { key: "ytd", label: "ytd" },
  { key: "all", label: "all" },
];

/** "12 closed trades from 2026-10-05 to today", in the reader's word order. */
function rangeLine(
  P: J["performance"],
  n: number,
  fromDate: string | null,
  toDate: string | null,
  toToday: boolean
): string {
  const count = plural(n, P.countOne, P.countOther);
  if (fromDate && toDate) return fmt(P.rangeFromTo, { count, from: fromDate, to: toDate });
  if (fromDate) return fmt(toToday ? P.rangeFromToday : P.rangeFrom, { count, from: fromDate });
  if (toDate) return fmt(P.rangeTo, { count, to: toDate });
  return count;
}

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
  accountBalance,
}: {
  trades: JournalTradeRow[];
  cashFlows: JournalCashFlowRow[];
  currency: string | null;
  accountBalance: number | null;
}) {
  const T = useT();
  const j = T.journal;
  const K = j.kpi;
  const P = j.performance;
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

  const a = useMemo(
    () => computeAnalytics(filtered, cashFlows, { currentBalance: accountBalance }),
    [filtered, cashFlows, accountBalance]
  );

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
    return computeAnalytics(priorTrades, cashFlows, { currentBalance: accountBalance });
  }, [range, closed, cashFlows, accountBalance]);

  const pill = (active: boolean) =>
    `cursor-pointer rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-colors ${
      active ? "bg-ink text-white" : "border border-line-strong text-ink hover:border-orange"
    }`;
  const dateInput =
    "rounded-lg border border-line-strong bg-card px-2 py-1 text-[12px] text-ink focus:border-orange/60 focus:outline-none";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink">{P.title}</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => setRange(p.key)} className={pill(range === p.key)}>
              {P.presets[p.label]}
            </button>
          ))}
          <button onClick={() => setRange("custom")} className={pill(range === "custom")}>
            {P.custom}
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
          <p className="text-[14px] text-subtle">{P.noClosed}</p>
        </section>
      ) : (
        <>
          <p className="-mt-3 text-[12px] text-subtle">
            {rangeLine(P, filtered.length, fromDate, toDate, range !== "all" && range !== "custom")}
          </p>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label={K.netPnl}
              value={money(a.netProfit, currency)}
              tone={a.netProfit > 0 ? "up" : a.netProfit < 0 ? "down" : undefined}
              hint={fmt(K.netPnlHint, { n: a.closedCount })}
              delta={kpiDelta(a.netProfit, prior?.netProfit ?? null, "money", { currency })}
              info={K.netPnlInfo}
            />
            <Kpi
              label={K.winRate}
              value={pct(a.winRate)}
              delta={kpiDelta(a.winRate, prior?.winRate ?? null, "pct", { pts: K.pts })}
              info={K.winRateInfo}
              infoAlign="right"
            />
            <Kpi
              label={K.profitFactor}
              value={profitFactorLabel(a)}
              delta={kpiDelta(a.profitFactor, prior?.profitFactor ?? null, "num")}
              info={K.profitFactorInfo}
            />
            <Kpi
              label={K.maxDrawdown}
              value={money(-a.maxDrawdown, currency)}
              tone={a.maxDrawdown > 0 ? "down" : undefined}
              hint={a.maxDrawdownPct == null ? undefined : pct(a.maxDrawdownPct)}
              delta={kpiDelta(a.maxDrawdown, prior?.maxDrawdown ?? null, "money", { higherIsBetter: false, currency })}
              info={K.maxDrawdownInfo}
              infoAlign="right"
            />
            <Kpi
              label={K.payoff}
              value={a.payoffRatio == null ? "—" : a.payoffRatio.toFixed(2)}
              hint={K.payoffHint}
              delta={kpiDelta(a.payoffRatio, prior?.payoffRatio ?? null, "num")}
              info={K.payoffInfo}
            />
            <Kpi
              label={K.expectancy}
              value={money(a.expectancy, currency)}
              hint={K.expectancyHint}
              delta={kpiDelta(a.expectancy, prior?.expectancy ?? null, "money", { currency })}
              info={K.expectancyInfo}
              infoAlign="right"
            />
            <Kpi
              label={K.bestWorst}
              value={`${money(a.largestWin, currency)} / ${money(a.largestLoss, currency)}`}
              info={K.bestWorstInfo}
            />
            <Kpi
              label={K.streaks}
              value={fmt(K.streaksValue, { w: a.longestWinStreak, l: a.longestLossStreak })}
              hint={
                a.currentStreak === 0
                  ? K.streakNone
                  : fmt(a.currentStreak > 0 ? K.streakWin : K.streakLoss, { n: Math.abs(a.currentStreak) })
              }
              info={K.streaksInfo}
              infoAlign="right"
            />
            <Kpi
              label={K.avgWinLoss}
              value={`${money(a.avgWin, currency)} / ${money(a.avgLoss == null ? null : -a.avgLoss, currency)}`}
              info={K.avgWinLossInfo}
            />
            <Kpi
              label={K.avgSize}
              value={a.avgLots == null ? "—" : fmt(j.lots, { n: a.avgLots })}
              info={K.avgSizeInfo}
              infoAlign="right"
            />
            <Kpi
              label={K.maxExposure}
              value={fmt(K.openCount, { n: a.maxConcurrentOpen })}
              hint={K.maxExposureHint}
              info={K.maxExposureInfo}
            />
            <Kpi
              label={K.avgHold}
              value={fmtDuration(a.avgDurationSec, j.durations)}
              info={K.avgHoldInfo}
              infoAlign="right"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title={j.charts.cumulative} subtitle={j.charts.cumulativeSub}>
              <EquityCurveChart points={a.equityCurve} />
            </ChartCard>
            <ChartCard title={j.charts.drawdown} subtitle={j.charts.drawdownSub}>
              <DrawdownChart points={a.drawdownCurve} />
            </ChartCard>
          </div>

          <ChartCard title={j.charts.distribution} subtitle={j.charts.distributionSub}>
            <PnlHistogram bins={a.pnlHistogram} />
          </ChartCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <BreakdownCard title={j.charts.bySymbol} rows={a.bySymbol} currency={currency} />
            <BreakdownCard
              title={j.charts.bySession}
              rows={a.bySession}
              currency={currency}
              label={(k) => sessionLabel(k, T.journalEngine)}
            />
            <BreakdownCard
              title={j.charts.byWeekday}
              rows={a.byWeekday}
              currency={currency}
              label={(k) => weekdayLabel(k, T.journalEngine)}
            />
          </div>

          {filtered.length > 0 && <TradesTable trades={filtered} currency={currency} />}
        </>
      )}
    </div>
  );
}

function TraderRadar({ analytics, game }: { analytics: JournalAnalytics; game: GameState }) {
  const j = useT().journal;
  const axes = [
    { label: j.kpi.winRate, value: analytics.winRate ?? 0 },
    {
      label: j.radar.profit,
      // all-wins (no losers) reads as a full-strength profit axis, not zero
      value:
        analytics.profitFactor == null
          ? analytics.grossWin > 0
            ? 1
            : 0
          : Math.min(1, analytics.profitFactor / 2.5),
    },
    { label: j.radar.rr, value: Math.min(1, (analytics.payoffRatio ?? 0) / 3) },
    { label: j.hero.discipline, value: (game.score ?? 0) / 100 },
    { label: j.radar.consistency, value: 1 - Math.min(1, analytics.maxDrawdownPct ?? 0) },
  ];
  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-soft">
      <h3 className="font-display text-[15px] font-bold text-ink">{j.radar.title}</h3>
      <p className="mt-0.5 text-[12px] text-subtle">{j.radar.sub}</p>
      <div className="mt-1">
        <RadarChart axes={axes} />
      </div>
    </section>
  );
}

// Connected, but the first sync hasn't produced closed trades yet. A branded
// "we're on it" state beats an empty dashboard.
function FirstRunPanel({ connecting }: { connecting: boolean }) {
  const f = useT().journal.firstRun;
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
        {connecting ? f.pullingTitle : f.noTradesTitle}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-subtle">
        {connecting ? f.pullingBody : f.noTradesBody}
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
        {f.setGoals}
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
  accountBalance,
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
  accountBalance: number | null;
}) {
  const T = useT();
  const j = T.journal;
  const intl = INTL_LOCALE[useLocale()];
  const closed = trades.filter((t) => t.status === "closed");
  const open = trades.filter((t) => t.status === "open");
  const hello = greeting(j.greeting);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">
      <InterventionBanner interventions={interventions} />
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
            {T.nav.aiAssistant}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">
            {profileName ? fmt(j.greeting.named, { greeting: hello, name: profileName }) : hello}
          </h1>
        </div>
        <p className="shrink-0 text-right text-[12px] text-subtle">
          {accounts[0]?.last_synced_at
            ? fmt(j.synced, { time: fmtTime(accounts[0].last_synced_at, intl) })
            : j.notSynced}
          <br />
          {plural(closed.length, j.tradesOne, j.tradesOther)}
        </p>
      </div>

      {accounts.length === 0 ? (
        <section className="rise mt-7 rounded-2xl border border-line bg-card p-8 text-center shadow-soft">
          <h2 className="font-display text-xl font-bold text-ink">
            {j.empty.title}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-subtle">
            {j.empty.body}
          </p>
          <Link
            href="/journal/connect"
            className="mt-5 inline-block cursor-pointer rounded-xl bg-orange px-6 py-3 text-[14px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
          >
            {j.empty.cta}
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

              <PerformanceSection
                trades={trades}
                cashFlows={cashFlows}
                currency={currency}
                accountBalance={accountBalance}
              />

              {closed.length > 0 && (
                <RulesCard rules={rules} config={rulesConfig} trades={trades} />
              )}

              {open.length > 0 && (
                <section className="rounded-2xl border border-line bg-card p-5 shadow-soft">
                  <p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">
                    {fmt(j.openPositions, { n: open.length })}
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
                          {directionLabel(t.direction, T.journalEngine)}
                        </span>
                        {fmt(j.positionLine, { symbol: t.symbol, volume: t.volume })}
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
