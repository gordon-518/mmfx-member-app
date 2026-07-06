"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { HeadlineStats } from "@/lib/journal/metrics";
import type {
  JournalAccountRow,
  JournalGoalsRow,
  JournalTradeRow,
} from "@/lib/journal/types";

// Client half of /journal: account card actions (Sync now / Disconnect),
// headline stat tiles, open-positions strip, and the closed-trades table.
// Data arrives fully-fetched from the server component; mutations go through
// /api/journal/* and re-render via router.refresh().

const PAGE_SIZE = 25;

function fmtMoney(n: number | null | undefined, currency?: string | null): string {
  if (n == null) return "—";
  const s = n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n < 0 ? "" : ""}${s}${currency ? ` ${currency}` : ""}`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDuration(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${(sec / 3600).toFixed(1)}h`;
  return `${(sec / 86400).toFixed(1)}d`;
}

const STATE_CHIP: Record<string, { label: string; cls: string }> = {
  connecting: {
    label: "Connecting…",
    cls: "bg-amber-100 text-amber-800",
  },
  deployed: { label: "Connected", cls: "bg-accent-soft text-accent-ink" },
  failed: { label: "Connection failed", cls: "bg-red-100 text-red-700" },
};

function AccountCard({ account }: { account: JournalAccountRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"sync" | "disconnect" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const chip = STATE_CHIP[account.state] ?? STATE_CHIP.connecting;

  // While MetaApi is still deploying the account, poll for the state flip.
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
              {account.label || `MT5 ·${account.mt5_login}`}
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
            {fmtMoney(account.balance, account.currency)}
          </p>
          <p className="text-[13px] text-subtle">
            {fmtMoney(account.equity, account.currency)}
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
          Last synced: {account.last_synced_at ? fmtTime(account.last_synced_at) : "never"}
        </span>
      </div>
      {message && <p className="mt-3 text-[13px] text-subtle">{message}</p>}
    </section>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-soft">
      <p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">
        {label}
      </p>
      <p
        className={`mt-1.5 font-display text-2xl font-bold ${
          tone === "up"
            ? "text-emerald-600"
            : tone === "down"
              ? "text-red-600"
              : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
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
            <p className="text-[13px] italic text-subtle">
              “{goals.focus_text}”
            </p>
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

function TradesTable({ trades }: { trades: JournalTradeRow[] }) {
  const [page, setPage] = useState(0);
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
      <div className="mt-3 overflow-x-auto pb-2">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wider text-subtle">
              <th className="px-6 py-2.5 font-semibold">Symbol</th>
              <th className="px-3 py-2.5 font-semibold">Side</th>
              <th className="px-3 py-2.5 font-semibold">Lots</th>
              <th className="px-3 py-2.5 font-semibold">Open</th>
              <th className="px-3 py-2.5 font-semibold">Close</th>
              <th className="px-3 py-2.5 font-semibold">Duration</th>
              <th className="px-6 py-2.5 text-right font-semibold">Net P&L</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((t) => (
              <tr key={t.id} className="border-b border-line/60 text-ink">
                <td className="px-6 py-2.5 font-semibold">{t.symbol}</td>
                <td
                  className={`px-3 py-2.5 font-semibold uppercase ${
                    t.direction === "buy" ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {t.direction}
                </td>
                <td className="px-3 py-2.5">{t.volume}</td>
                <td className="px-3 py-2.5 text-subtle">{fmtTime(t.open_time)}</td>
                <td className="px-3 py-2.5 text-subtle">{fmtTime(t.close_time)}</td>
                <td className="px-3 py-2.5 text-subtle">
                  {fmtDuration(t.duration_sec)}
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
                  {fmtMoney(t.net_profit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function JournalDashboard({
  accounts,
  closedTrades,
  openTrades,
  goals,
  stats,
}: {
  accounts: JournalAccountRow[];
  closedTrades: JournalTradeRow[];
  openTrades: JournalTradeRow[];
  goals: JournalGoalsRow | null;
  stats: HeadlineStats;
}) {
  const currency = accounts[0]?.currency ?? null;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-10">
      <div className="rise">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
          Tools · AI Trading Journal
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">
          Trading Journal
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">
          Your MT5 trades, synced automatically and measured against your
          goals. Analytics and AI coaching build on this record.
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
        <div className="mt-7 space-y-6">
          {accounts.map((a) => (
            <AccountCard key={a.id} account={a} />
          ))}

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Net P&L"
              value={fmtMoney(stats.netProfit, currency)}
              tone={
                stats.netProfit > 0 ? "up" : stats.netProfit < 0 ? "down" : undefined
              }
            />
            <StatTile
              label="Win rate"
              value={
                stats.winRate == null
                  ? "—"
                  : `${Math.round(stats.winRate * 100)}%`
              }
            />
            <StatTile label="Closed trades" value={String(stats.tradeCount)} />
            <StatTile
              label="Profit factor"
              value={
                stats.profitFactor == null ? "—" : stats.profitFactor.toFixed(2)
              }
            />
          </div>

          <GoalsCard goals={goals} />

          {openTrades.length > 0 && (
            <section className="rounded-2xl border border-line bg-card p-5 shadow-soft">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">
                Open positions ({openTrades.length})
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {openTrades.map((t) => (
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

          {closedTrades.length > 0 ? (
            <TradesTable trades={closedTrades} />
          ) : (
            <section className="rounded-2xl border border-line bg-card p-6 text-center shadow-soft">
              <p className="text-[14px] text-subtle">
                No closed trades yet — history appears here after the first
                sync completes.
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
