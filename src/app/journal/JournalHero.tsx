"use client";

import { useCountUp } from "./useCountUp";
import { signedMoney, pct } from "./format";
import { InfoTip } from "./InfoTip";
import type { GameState } from "@/lib/journal/gamification";
import type { Health } from "@/lib/journal/health";
import type { JournalAnalytics } from "@/lib/journal/analytics";

const SURVIVAL: Record<Health["status"], { label: string; cls: string }> = {
  healthy: { label: "Healthy", cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  at_risk: { label: "At risk", cls: "bg-amber-50 border-amber-200 text-amber-700" },
  critical: { label: "Critical", cls: "bg-red-50 border-red-200 text-red-700" },
};

function Ring({ score }: { score: number }) {
  const v = useCountUp(score);
  const C = 2 * Math.PI * 52;
  const off = C * (1 - Math.max(0, Math.min(100, v)) / 100);
  return (
    <div className="relative h-[132px] w-[132px] shrink-0">
      <svg viewBox="0 0 120 120" className="h-[132px] w-[132px] -rotate-90">
        <circle cx="60" cy="60" r="52" fill="none" strokeWidth="12" className="stroke-line" />
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          stroke="#ff5a1f"
          strokeDasharray={C}
          strokeDashoffset={off}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-extrabold leading-none text-ink">
          {Math.round(v)}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-subtle">
          Discipline
        </span>
      </div>
    </div>
  );
}

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
  tone?: "up";
  info?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-paper/60 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-subtle">
        {label}
        {info && <InfoTip text={info} />}
      </p>
      <p className={`mt-1 font-display text-lg font-extrabold ${tone === "up" ? "text-emerald-600" : "text-ink"}`}>
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
  const s = SURVIVAL[health.status];
  return (
    <section className="rise rounded-3xl border border-line bg-card p-6 shadow-soft">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex shrink-0 flex-col items-center">
          <Ring score={game.score ?? 0} />
          {game.rulesSet ? (
            <span className="mt-2 inline-flex items-center text-[11px] text-subtle">
              % of clean trading days
              <InfoTip text="Your discipline score is the share of your last 30 trading days with zero breaches of the rules you set — process, independent of P&L." />
            </span>
          ) : (
            <a
              href="/journal#rules"
              className="mt-2.5 rounded-full border border-line-strong px-3 py-1 text-[12px] font-semibold text-ink"
            >
              Set rules to track discipline →
            </a>
          )}
        </div>

        <div className="grid flex-1 grid-cols-2 gap-2.5 sm:grid-cols-3">
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
            sub={analytics.profitFactor == null ? undefined : `PF ${analytics.profitFactor.toFixed(2)}`}
            info="Share of your closed trades that finished in profit, across all synced history."
          />
          <Vital
            label="This month"
            value={signedMoney(monthNet, currency)}
            sub={`${monthCount} trades`}
            tone={monthNet > 0 ? "up" : undefined}
            info="Net realised P&L from trades closed since the 1st of the current calendar month."
          />
        </div>
      </div>
    </section>
  );
}
