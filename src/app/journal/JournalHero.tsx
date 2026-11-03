"use client";

import { useCountUp } from "./useCountUp";
import { signedMoney, money, pct, profitFactorLabel } from "./format";
import { InfoTip } from "./InfoTip";
import { EquityCurveChart } from "./charts";
import type { GameState } from "@/lib/journal/gamification";
import type { Health } from "@/lib/journal/health";
import type { JournalAnalytics } from "@/lib/journal/analytics";
import { useT } from "@/i18n/client";
import { fmt, plural } from "@/i18n/format";

const SURVIVAL_CLS: Record<Health["status"], string> = {
  healthy: "bg-emerald-50 border-emerald-200 text-emerald-700",
  at_risk: "bg-amber-50 border-amber-200 text-amber-700",
  critical: "bg-red-50 border-red-200 text-red-700",
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
  const j = useT().journal;
  const h = j.hero;
  const s = health.hasEquityBasis
    ? { label: h.survivalStatus[health.status], cls: SURVIVAL_CLS[health.status] }
    : { label: "—", cls: "border-line bg-paper/60 text-subtle" };
  const net = useCountUp(monthNet);
  const up = monthNet >= 0;

  return (
    <section className="rise rounded-3xl border border-line bg-card p-6 shadow-soft">
      {/* Headline: net P&L this month + risk snapshot */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-subtle">{h.netThisMonth}</p>
          <p
            className={`mt-1 font-display text-4xl font-extrabold leading-none ${
              up ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {signedMoney(net, currency)}
          </p>
          <p className="mt-1.5 text-[13px] text-subtle">
            {[
              plural(monthCount, j.tradesOne, j.tradesOther),
              analytics.winRate != null && fmt(h.winRate, { pct: pct(analytics.winRate) }),
              analytics.expectancy != null &&
                fmt(h.perTrade, { amount: signedMoney(analytics.expectancy, currency) }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-faint">{j.kpi.maxDrawdown}</p>
          <p className="font-display text-base font-bold text-ink">
            {money(-analytics.maxDrawdown, currency)}
          </p>
          {analytics.maxDrawdownPct != null && (
            <p className="text-[12px] font-medium text-red-600">
              {fmt(h.peakToTrough, { pct: pct(analytics.maxDrawdownPct) })}
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
            {h.survival}
            <InfoTip text={h.survivalInfo} />
          </p>
          <p className="mt-1 font-display text-lg font-extrabold">{s.label}</p>
          <p className="text-[11px] opacity-80">{health.runwaySentence}</p>
        </div>
        <Vital
          label={j.kpi.winRate}
          value={pct(analytics.winRate)}
          sub={
            analytics.profitFactor != null || analytics.grossWin > 0
              ? fmt(h.pf, { pf: profitFactorLabel(analytics) })
              : undefined
          }
          info={h.winRateInfo}
        />
        <Vital
          label={j.kpi.profitFactor}
          value={profitFactorLabel(analytics)}
          info={h.profitFactorInfo}
        />
        <Vital
          label={h.discipline}
          value={game.score == null ? "—" : `${game.score}%`}
          sub={game.rulesSet ? h.cleanDays : h.setRules}
          info={h.disciplineInfo}
        />
      </div>
    </section>
  );
}
