"use client";

import { useCountUp } from "./useCountUp";
import { signedMoney, money, pct, profitFactorLabel } from "./format";
import { InfoTip } from "./InfoTip";
import { EquityCurveChart } from "./charts";
import type { GameState } from "@/lib/journal/gamification";
import type { Health } from "@/lib/journal/health";
import type { JournalAnalytics } from "@/lib/journal/analytics";

const SURVIVAL: Record<Health["status"], { label: string; cls: string }> = {
  healthy: { label: "Healthy", cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  at_risk: { label: "At risk", cls: "bg-amber-50 border-amber-200 text-amber-700" },
  critical: { label: "Critical", cls: "bg-red-50 border-red-200 text-red-700" },
};

function Vital({
  label,
  value,
  sub,
  tone,
  info,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "up" | "down";
  info?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-paper/60 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-subtle">
        {label}
        {info && <InfoTip text={info} />}
      </p>
      <p
        className={`mt-1 font-display text-lg font-extrabold ${
          tone === "up" ? "text-emerald-600" : tone === "down" ? "text-red-600" : "text-ink"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-subtle">{sub}</p>}
    </div>
  );
}

export function JournalHero({
  game,
  health,
  analytics,
  monthNet,
  monthCount,
  currency,
}: {
  game: GameState;
  health: Health;
  analytics: JournalAnalytics;
  monthNet: number;
  monthCount: number;
  currency: string | null;
}) {
  const s = health.hasEquityBasis
    ? SURVIVAL[health.status]
    : { label: "—", cls: "border-line bg-paper/60 text-subtle" };
  const net = useCountUp(monthNet);
  const up = monthNet >= 0;

  return (
    <section className="rise rounded-3xl border border-line bg-card p-6 shadow-soft">
      {/* Headline: net P&L this month + risk snapshot */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-subtle">
            Net P&amp;L · this month
          </p>
          <p
            className={`mt-1 font-display text-4xl font-extrabold leading-none ${
              up ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {signedMoney(net, currency)}
          </p>
          <p className="mt-1.5 text-[13px] text-subtle">
            {monthCount} trade{monthCount === 1 ? "" : "s"}
            {analytics.winRate != null ? ` · ${pct(analytics.winRate)} win rate` : ""}
            {analytics.expectancy != null ? ` · ${signedMoney(analytics.expectancy, currency)}/trade` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-faint">Max drawdown</p>
          <p className="font-display text-base font-bold text-ink">
            {money(-analytics.maxDrawdown, currency)}
          </p>
          {analytics.maxDrawdownPct != null && (
            <p className="text-[12px] font-medium text-red-600">
              {pct(analytics.maxDrawdownPct)} peak-to-trough
            </p>
          )}
        </div>
      </div>

      {/* The signature: cumulative equity curve */}
      <div className="mt-3">
        <EquityCurveChart points={analytics.equityCurve} />
      </div>

      {/* Supporting vitals */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className={`rounded-2xl border p-3 ${s.cls}`}>
          <p className="text-[11px] font-bold uppercase tracking-wider">
            Survival
            <InfoTip text="How close you are to your max-drawdown limit, in losing trades of runway. Uses your goal's max drawdown, or a 15% default if unset." />
          </p>
          <p className="mt-1 font-display text-lg font-extrabold">{s.label}</p>
          <p className="text-[11px] opacity-80">{health.runwaySentence}</p>
        </div>
        <Vital
          label="Win rate"
          value={pct(analytics.winRate)}
          sub={
            analytics.profitFactor != null || analytics.grossWin > 0
              ? `PF ${profitFactorLabel(analytics)}`
              : undefined
          }
          info="Share of your DECISIVE trades (wins ÷ wins+losses, excluding break-evens) that finished in profit."
        />
        <Vital
          label="Profit factor"
          value={profitFactorLabel(analytics)}
          info="Gross profit ÷ gross loss. Above 1.0 means your winners outweigh your losers; ∞ means no losing trades."
        />
        <Vital
          label="Discipline"
          value={game.score == null ? "—" : `${game.score}%`}
          sub={game.rulesSet ? "clean days" : "set rules →"}
          info="Share of your last 30 trading days with zero rule breaches — process, independent of P&L."
        />
      </div>
    </section>
  );
}
