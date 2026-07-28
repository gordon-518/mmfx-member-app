"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import type { JournalAnalytics } from "@/lib/journal/analytics";
import type { LeakResult } from "@/lib/journal/leaks";
import type { Health } from "@/lib/journal/health";
import type { RulesResult } from "@/lib/journal/rules";
import type { Intervention } from "@/lib/journal/interventions";
import type { GameState } from "@/lib/journal/gamification";
import { InterventionBanner } from "./InterventionBanner";
import { JournalHero } from "./JournalHero";
import { LevelBar } from "./LevelBar";
import { MissionCard } from "./MissionCard";
import { LeaksToBeat } from "./LeaksToBeat";
import { RulesCard } from "./RulesCard";
import { money, pct, fmtTime, fmtDuration } from "./format";
import {
  JOURNAL_EMOTIONS,
  type JournalAccountRow,
  type JournalGoalsRow,
  type JournalReportRow,
  type JournalRulesConfig,
  type JournalTradeRow,
} from "@/lib/journal/types";
import { DrawdownChart, EquityCurveChart, PnlHistogram } from "./charts";

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

  return (
    <section className="rise rounded-2xl border border-line bg-card p-6 shadow-soft sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-lg font-bold text-ink">
              {account.label || `MT5 · ${account.mt5_login}`}
            </h2>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${chip.cls}`}
            >
              {chip.label}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-subtle">
            {account.mt5_login} · {account.broker_server}
          </p>
          {account.state === "failed" && account.state_detail && (
            <p className="mt-2 text-[13px] text-red-600">
              {account.state_detail}{" "}
              <Link href="/journal/connect" className="font-semibold underline">
                Retry
              </Link>
            </p>
          )}
          {account.sync_error && account.state === "deployed" && (
            <p className="mt-2 text-[13px] text-amber-700">
              Last sync problem: {account.sync_error}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[12px] uppercase tracking-wider text-subtle">
            Balance / Equity
          </p>
          <p className="mt-0.5 font-display text-xl font-bold text-ink">
            {money(account.balance, account.currency)}
          </p>
          <p className="text-[13px] text-subtle">
            {money(account.equity, account.currency)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          onClick={syncNow}
          disabled={busy !== null || account.state !== "deployed"}
          className="cursor-pointer rounded-xl bg-orange px-4 py-2 text-[13px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "sync" ? "Queuing…" : "Sync now"}
        </button>
        <button
          onClick={disconnect}
          disabled={busy !== null}
          className="cursor-pointer rounded-xl border border-line-strong bg-card px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50"
        >
          {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
        </button>
        <span className="text-[12px] text-subtle">
          Last synced:{" "}
          {account.last_synced_at ? fmtTime(account.last_synced_at) : "never"}
        </span>
      </div>
      {message && <p className="mt-3 text-[13px] text-subtle">{message}</p>}
    </section>
  );
}

function Kpi({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-soft">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
        {label}
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
      {hint && <p className="mt-0.5 text-[11px] text-subtle">{hint}</p>}
    </div>
  );
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
  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-soft">
      <h3 className="mb-2 font-display text-[15px] font-bold text-ink">{title}</h3>
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-subtle">
            <th className="py-1 font-semibold">Name</th>
            <th className="py-1 text-right font-semibold">Trades</th>
            <th className="py-1 text-right font-semibold">Win %</th>
            <th className="py-1 text-right font-semibold">Net P&L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line/50 text-ink">
              <td className="py-1.5 font-semibold">{r.key}</td>
              <td className="py-1.5 text-right text-subtle">{r.count}</td>
              <td className="py-1.5 text-right text-subtle">
                {Math.round(r.winRate * 100)}%
              </td>
              <td
                className={`py-1.5 text-right font-semibold ${
                  r.netProfit > 0
                    ? "text-emerald-600"
                    : r.netProfit < 0
                      ? "text-red-500"
                      : "text-ink"
                }`}
              >
                {money(r.netProfit, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

function CoachCard({
  report,
  reportsRemaining,
  reportCap,
}: {
  report: JournalReportRow | null;
  reportsRemaining: number;
  reportCap: number;
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
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange text-white">
            ✦
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-ink">AI Coach</h2>
            {report && (
              <p className="text-[12px] text-subtle">
                {new Date(report.report_date).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            )}
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
            disabled={busy || outOfQuota}
            className="cursor-pointer rounded-xl bg-orange px-4 py-2 text-[13px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy
              ? "Analysing…"
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
        <div className="mt-4 space-y-4">
          <p className="text-[15px] leading-relaxed text-ink">{report.summary}</p>

          {report.habits.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {report.habits.map((h, i) => (
                <div
                  key={i}
                  className={`rounded-xl border p-3 ${
                    h.kind === "good"
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <p
                    className={`text-[13px] font-semibold ${
                      h.kind === "good" ? "text-emerald-800" : "text-amber-800"
                    }`}
                  >
                    {h.kind === "good" ? "✓ " : "△ "}
                    {h.title}
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink/80">
                    {h.detail}
                  </p>
                </div>
              ))}
            </div>
          )}

          {report.tips.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">
                Trade-management tips
              </p>
              <ul className="mt-1.5 space-y-1">
                {report.tips.map((t, i) => (
                  <li key={i} className="flex gap-2 text-[14px] text-ink">
                    <span className="text-orange">→</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-[14px] leading-relaxed text-subtle">
          Generate an AI read of your trading — it measures your habits against
          your goals, flags what’s working and what isn’t, and gives concrete
          trade-management tips. Runs automatically each day once live.
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
          Tell the journal what you’re aiming for — the AI coach (coming soon)
          measures every habit against it.
        </p>
      )}
    </section>
  );
}

export function JournalDashboard({
  accounts,
  trades,
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
  const a = analytics;
  const closed = trades.filter((t) => t.status === "closed");
  const open = trades.filter((t) => t.status === "open");

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-10">
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

      {closed.length > 0 && (
        <div className="space-y-4">
          <JournalHero
            game={game}
            health={health}
            analytics={analytics}
            monthNet={monthNet}
            monthCount={monthCount}
            currency={currency}
          />
          <LevelBar game={game} />
          <MissionCard interventions={interventions} game={game} />
          <LeaksToBeat leaks={leaks} trades={trades} />
        </div>
      )}

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
        <div className="mt-7 space-y-6">
          {accounts.map((acct) => (
            <AccountCard key={acct.id} account={acct} />
          ))}

          <CoachCard
            report={report}
            reportsRemaining={reportsRemaining}
            reportCap={reportCap}
          />

          <h2 className="mt-2 font-display text-xl font-bold text-ink">Performance</h2>

          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Net P&L"
              value={money(a.netProfit, currency)}
              tone={a.netProfit > 0 ? "up" : a.netProfit < 0 ? "down" : undefined}
              hint={`${a.closedCount} closed · ${a.openCount} open`}
            />
            <Kpi label="Win rate" value={pct(a.winRate)} />
            <Kpi
              label="Profit factor"
              value={a.profitFactor == null ? "—" : a.profitFactor.toFixed(2)}
            />
            <Kpi
              label="Max drawdown"
              value={money(-a.maxDrawdown, currency)}
              tone={a.maxDrawdown > 0 ? "down" : undefined}
              hint={a.maxDrawdownPct == null ? undefined : pct(a.maxDrawdownPct)}
            />
            <Kpi
              label="Payoff (R:R)"
              value={a.payoffRatio == null ? "—" : a.payoffRatio.toFixed(2)}
              hint="avg win ÷ avg loss"
            />
            <Kpi
              label="Expectancy"
              value={money(a.expectancy, currency)}
              hint="per trade"
            />
            <Kpi
              label="Best / worst"
              value={`${money(a.largestWin, currency)} / ${money(a.largestLoss, currency)}`}
            />
            <Kpi
              label="Streaks"
              value={`${a.longestWinStreak}W · ${a.longestLossStreak}L`}
              hint={
                a.currentStreak === 0
                  ? "no current streak"
                  : `current ${Math.abs(a.currentStreak)}${a.currentStreak > 0 ? "W" : "L"}`
              }
            />
            <Kpi
              label="Avg win / loss"
              value={`${money(a.avgWin, currency)} / ${money(a.avgLoss == null ? null : -a.avgLoss, currency)}`}
            />
            <Kpi label="Avg size" value={a.avgLots == null ? "—" : `${a.avgLots} lots`} />
            <Kpi
              label="Max exposure"
              value={`${a.maxConcurrentOpen} open`}
              hint="concurrent positions"
            />
            <Kpi label="Avg hold" value={fmtDuration(a.avgDurationSec)} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Cumulative P&L" subtitle="Closed trades, in order">
              <EquityCurveChart points={a.equityCurve} />
            </ChartCard>
            <ChartCard title="Drawdown" subtitle="Distance below running peak">
              <DrawdownChart points={a.drawdownCurve} />
            </ChartCard>
          </div>

          <ChartCard
            title="P&L distribution"
            subtitle="How your winners and losers are spread"
          >
            <PnlHistogram bins={a.pnlHistogram} />
          </ChartCard>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <BreakdownCard title="By symbol" rows={a.bySymbol} currency={currency} />
            <BreakdownCard title="By session" rows={a.bySession} currency={currency} />
            <BreakdownCard title="By weekday" rows={a.byWeekday} currency={currency} />
          </div>

          {closed.length > 0 && (
            <RulesCard rules={rules} config={rulesConfig} trades={trades} />
          )}

          <GoalsCard goals={goals} />

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
                        t.direction === "buy"
                          ? "text-emerald-600"
                          : "text-red-500"
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

          {closed.length > 0 ? (
            <TradesTable trades={closed} currency={currency} />
          ) : (
            <section className="rounded-2xl border border-line bg-card p-6 text-center shadow-soft">
              <p className="text-[14px] text-subtle">
                No closed trades yet — history appears here after the first sync
                completes.
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
