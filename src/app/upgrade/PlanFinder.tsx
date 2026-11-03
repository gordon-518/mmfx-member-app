"use client";

import { useState } from "react";
import { BUDGETS, GOALS, budgetLabel, recommendTier, type Budget, type Goal } from "@/lib/upgradeContent";
import { TIER_THRESHOLDS } from "@/lib/tiers";
import { useT } from "@/i18n/client";
import { fmt } from "@/i18n/format";

// "Not sure which tier?" (the redesign's take on Higgsfield's plan finder).
// Two questions, plus the Know Your Style archetype we already have, give one
// recommendation with the reason, so the trader doesn't have to compare cards.
// `archetype` is profiles.kys_archetype: the archetype ID, not its display name.

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`cursor-pointer rounded-xl border px-3.5 py-2.5 text-left text-[13.5px] font-medium transition-colors ${
        active
          ? "border-orange bg-accent-soft text-accent-ink"
          : "border-line bg-card text-ink hover:border-orange/40"
      }`}
    >
      {children}
    </button>
  );
}

export function PlanFinder({ archetype, isMember }: { archetype: string | null; isMember: boolean }) {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const t = useT();
  const p = t.plans;
  const rec = goal ? recommendTier(goal, budget, archetype, p, t.tiers) : null;

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-soft sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">{p.finderStep1}</p>
      <p className="mt-1 text-[15px] font-semibold text-ink">{p.finderQ1}</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {GOALS.map((g) => (
          <Pill key={g} active={goal === g} onClick={() => setGoal(g)}>
            {p.goals[g]}
          </Pill>
        ))}
      </div>

      <p className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-faint">{p.finderStep2}</p>
      <p className="mt-1 text-[15px] font-semibold text-ink">{p.finderQ2}</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {BUDGETS.map((b) => (
          <Pill key={b} active={budget === b} onClick={() => setBudget(budget === b ? null : b)}>
            {budgetLabel(b, p)}
          </Pill>
        ))}
      </div>

      {rec && (
        <div className="mt-6 rounded-xl border border-orange/30 bg-accent-soft/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-orange">{p.recommend}</p>
          <p className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">
            {t.tiers[rec.tier]}{" "}
            <span className="text-[14px] font-semibold text-subtle">
              {fmt(p.recommendTotal, { amount: `$${TIER_THRESHOLDS[rec.tier]}` })}
            </span>
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-ink">{rec.why}</p>
          {rec.archetypeLine && <p className="mt-1.5 text-[13.5px] leading-relaxed text-subtle">{rec.archetypeLine}</p>}
          {rec.startNote && <p className="mt-1.5 text-[13.5px] leading-relaxed text-subtle">{rec.startNote}</p>}
          <a
            href={isMember ? "#submit-deposit" : "#get-started"}
            className="mt-4 inline-block rounded-xl bg-orange px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-soft transition-colors hover:bg-[#f24e12]"
          >
            {isMember ? p.submitTopUp : p.openAccount}
          </a>
        </div>
      )}
    </div>
  );
}
