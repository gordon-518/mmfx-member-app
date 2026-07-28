"use client";

import { useState } from "react";
import { signedMoney } from "./format";
import type { Leak, LeakResult } from "@/lib/journal/leaks";
import type { JournalTradeRow } from "@/lib/journal/types";

function LeakRow({
  leak,
  tradesById,
}: {
  leak: Leak;
  tradesById: Map<string, JournalTradeRow>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-line bg-card p-3.5 shadow-soft">
      <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen((o) => !o)}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
          ◆
        </span>
        <span className="flex-1">
          <span className="block text-[14px] font-bold text-ink">{leak.title}</span>
          <span className="block text-[12px] text-subtle">
            {leak.detail}
            {leak.tier === "what_if" ? " · what-if" : ""}
          </span>
        </span>
        <span
          className={`shrink-0 text-right font-display text-[15px] font-extrabold ${
            leak.dollarImpact < 0 ? "text-red-600" : "text-emerald-600"
          }`}
        >
          {signedMoney(leak.dollarImpact)}
        </span>
      </button>
      {open && (
        <div className="mt-2.5 space-y-1 border-t border-line pt-2 text-[12px]">
          {leak.tradeIds.map((id) => {
            const tr = tradesById.get(id);
            if (!tr) return null;
            return (
              <div key={id} className="flex justify-between text-subtle">
                <span>
                  {tr.symbol} {tr.direction} · {tr.volume} lots ·{" "}
                  {tr.close_time ? new Date(tr.close_time).toLocaleDateString() : ""}
                </span>
                <span className={tr.net_profit < 0 ? "text-red-600" : "text-emerald-600"}>
                  {signedMoney(tr.net_profit)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LeaksToBeat({
  leaks,
  trades,
}: {
  leaks: LeakResult;
  trades: JournalTradeRow[];
}) {
  if (!leaks.leaks.length) return null;
  const tradesById = new Map(trades.map((t) => [t.id, t]));
  const recoverable = leaks.leaks
    .filter((l) => l.tier !== "what_if")
    .reduce((s, l) => s + l.dollarImpact, 0);
  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between px-1">
        <h2 className="font-display text-lg font-bold text-ink">Leaks to beat</h2>
        {recoverable < 0 && (
          <p className="text-[12px] text-subtle">
            Fix all → recover <strong className="text-accent-ink">{signedMoney(-recoverable)}</strong>
          </p>
        )}
      </div>
      <div className="space-y-2">
        {leaks.leaks.map((l) => (
          <LeakRow key={l.type} leak={l} tradesById={tradesById} />
        ))}
      </div>
      {leaks.strengths.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 px-1 text-[12px] font-bold uppercase tracking-wider text-subtle">
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
