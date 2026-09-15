"use client";

import { useState } from "react";
import { CARD_ROWS, includes } from "@/lib/upgradeContent";
import { TIER_THRESHOLDS, nextTierFor, paidTierFor, tierLabel } from "@/lib/tiers";

// "How much will you deposit?" (the redesign's take on Higgsfield's credit
// slider). Drag a total and see which tier it lands on and what opens. For a
// paying member the slider starts at their current total, and shows the top-up
// to reach it. Deposits are the trader's own money, so the framing is
// "what it opens", never "what it earns".

const MAX = 1000;
const MARKS = [TIER_THRESHOLDS.foundation, TIER_THRESHOLDS.desk, TIER_THRESHOLDS.team];

function usd(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function DepositSlider({ cumulative, isMember }: { cumulative: number; isMember: boolean }) {
  const min = isMember ? Math.min(MAX, Math.max(50, Math.ceil(cumulative / 10) * 10)) : 50;
  const suggested = isMember ? (nextTierFor(cumulative) ? TIER_THRESHOLDS[nextTierFor(cumulative)!.next] : min) : TIER_THRESHOLDS.desk;
  const [amount, setAmount] = useState<number>(Math.max(min, suggested));

  const tier = paidTierFor(amount);
  const opens = tier ? CARD_ROWS.filter((r) => includes(tier, r)) : [];
  const topUp = Math.max(0, amount - cumulative);

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold text-ink">
          {isMember ? "Your total deposits after a top-up" : "Your total deposits"}
        </p>
        <p className="font-display text-3xl font-bold tracking-tight text-ink">{usd(amount)}</p>
      </div>

      <input
        type="range"
        min={min}
        max={MAX}
        step={10}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        aria-label="Total deposits"
        className="mt-4 w-full cursor-pointer accent-orange"
      />
      <div className="relative mt-1 h-4 text-[11px] font-medium text-faint">
        {MARKS.filter((m) => m >= min).map((m) => (
          <span
            key={m}
            className="absolute -translate-x-1/2"
            style={{ left: `${((m - min) / (MAX - min)) * 100}%` }}
          >
            {usd(m)}
          </span>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-orange/25 bg-accent-soft/40 p-4">
        <p className="text-[14px] text-ink">
          {tier ? (
            <>
              That&apos;s <span className="font-bold">{tierLabel(tier)}</span>
              {isMember && topUp > 0 ? `, a top-up of ${usd(topUp)}` : ""}. It opens:
            </>
          ) : (
            "Below $50 nothing extra opens yet."
          )}
        </p>
        {opens.length > 0 && (
          <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {opens.map((r) => (
              <li key={r.key} className="flex items-center gap-2 text-[13px] text-ink">
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange" />
                {r.label}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[12.5px] text-subtle">
          All of it stays in your own trading account. Your tier counts total deposits, never your balance.
        </p>
      </div>
    </div>
  );
}
