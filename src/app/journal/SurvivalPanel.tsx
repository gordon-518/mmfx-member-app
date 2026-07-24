"use client";

import { useState } from "react";
import type { Leak, LeakResult } from "@/lib/journal/leaks";
import type { Health } from "@/lib/journal/health";
import type { JournalTradeRow } from "@/lib/journal/types";

const STATUS: Record<Health["status"], { label: string; cls: string }> = {
  healthy: { label: "Healthy", cls: "bg-emerald-100 text-emerald-800" },
  at_risk: { label: "At risk", cls: "bg-amber-100 text-amber-800" },
  critical: { label: "Critical", cls: "bg-red-100 text-red-700" },
};
const money = (n: number) =>
  `${n < 0 ? "−" : "+"}$${Math.abs(n).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;

function LeakRow({
  leak,
  tradesById,
  big,
}: {
  leak: Leak;
  tradesById: Map<string, JournalTradeRow>;
  big?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border border-line ${big ? "bg-canvas/60 p-4" : "p-3"}`}>
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <p className={`font-semibold text-ink ${big ? "text-[16px]" : "text-[14px]"}`}>
            {leak.title}
          </p>
          <p className="text-[12px] text-subtle">
            {leak.detail}
            {leak.tier === "what_if" ? " · what-if" : ""}
          </p>
        </div>
        <span
          className={`shrink-0 pl-3 font-bold ${big ? "text-[20px]" : "text-[15px]"} ${
            leak.dollarImpact < 0 ? "text-red-600" : "text-emerald-600"
          }`}
        >
          {money(leak.dollarImpact)}
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-1 border-t border-line pt-2 text-[12px]">
          {leak.tradeIds.map((id) => {
            const t = tradesById.get(id);
            if (!t) return null;
            return (
              <div key={id} className="flex justify-between text-subtle">
                <span>
                  {t.symbol} {t.direction} · {t.volume} lots ·{" "}
                  {t.close_time ? new Date(t.close_time).toLocaleDateString() : ""}
                </span>
                <span className={t.net_profit < 0 ? "text-red-600" : "text-emerald-600"}>
                  {money(t.net_profit)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SurvivalPanel({
  leaks,
  health,
  trades,
}: {
  leaks: LeakResult;
  health: Health;
  trades: JournalTradeRow[];
}) {
  const tradesById = new Map(trades.map((t) => [t.id, t]));
  const s = STATUS[health.status];
  const [top, ...rest] = leaks.leaks;

  return (
    <section className="rise rounded-2xl border border-line bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-ink">Survival</h2>
        <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${s.cls}`}>
          {s.label}
        </span>
      </div>
      <p className="mt-2 text-[15px] font-semibold text-ink">{health.runwaySentence}</p>
      <p className="text-[12px] text-subtle">{health.factors.join(" · ")}</p>
      {health.usedDefaultTolerance && (
        <p className="mt-1 text-[12px] text-amber-700">
          Using a default 15% limit — set your max drawdown in goals for an accurate
          runway.
        </p>
      )}

      <div className="mt-5">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-subtle">
          Your biggest leak
        </p>
        {top ? (
          <div className="space-y-2">
            <LeakRow leak={top} tradesById={tradesById} big />
            {rest.map((l) => (
              <LeakRow key={l.type} leak={l} tradesById={tradesById} />
            ))}
          </div>
        ) : (
          <p className="text-[14px] text-subtle">
            No money-losing patterns detected in the last 90 days. Keep it up.
          </p>
        )}
      </div>

      {leaks.strengths.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-subtle">
            What&apos;s working
          </p>
          <div className="space-y-2">
            {leaks.strengths.map((st) => (
              <LeakRow key={st.type} leak={st} tradesById={tradesById} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
