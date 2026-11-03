"use client";

import { useState } from "react";
import { fmtDay, signedMoney } from "./format";
import type { Leak, LeakResult } from "@/lib/journal/leaks";
import type { JournalTradeRow } from "@/lib/journal/types";
import { directionLabel } from "@/lib/journal/labels";
import { useLocale, useT } from "@/i18n/client";
import { INTL_LOCALE } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { rich } from "@/i18n/rich";

function LeakRow({
  leak,
  tradesById,
  currency,
}: {
  leak: Leak;
  tradesById: Map<string, JournalTradeRow>;
  currency: string | null;
}) {
  const [open, setOpen] = useState(false);
  const T = useT();
  const intl = INTL_LOCALE[useLocale()];
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
            {leak.tier === "what_if" ? ` · ${T.journal.leaks.whatIf}` : ""}
          </span>
        </span>
        <span
          className={`shrink-0 text-right font-display text-[15px] font-extrabold ${
            leak.dollarImpact < 0 ? "text-red-600" : "text-emerald-600"
          }`}
        >
          {signedMoney(leak.dollarImpact, currency)}
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
                  {fmt(T.journal.trades.line, {
                    symbol: tr.symbol,
                    side: directionLabel(tr.direction, T.journalEngine),
                    volume: tr.volume,
                    date: fmtDay(tr.close_time, intl),
                  })}
                </span>
                <span className={tr.net_profit < 0 ? "text-red-600" : "text-emerald-600"}>
                  {signedMoney(tr.net_profit, currency)}
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
  currency,
}: {
  leaks: LeakResult;
  trades: JournalTradeRow[];
  currency: string | null;
}) {
  const L = useT().journal.leaks;
  if (!leaks.leaks.length) return null;
  const tradesById = new Map(trades.map((t) => [t.id, t]));
  const recoverable = leaks.leaks
    .filter((l) => l.tier !== "what_if")
    .reduce((s, l) => s + l.dollarImpact, 0);
  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between px-1">
        <h2 className="font-display text-lg font-bold text-ink">{L.title}</h2>
        {recoverable < 0 && (
          <p className="text-[12px] text-subtle">
            {rich(L.fixAll, {
              amount: <strong className="text-accent-ink">{signedMoney(-recoverable, currency)}</strong>,
            })}
          </p>
        )}
      </div>
      <div className="space-y-2">
        {leaks.leaks.map((l) => (
          <LeakRow key={l.type} leak={l} tradesById={tradesById} currency={currency} />
        ))}
      </div>
      {leaks.strengths.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 px-1 text-[12px] font-bold uppercase tracking-wider text-subtle">
            {L.working}
          </p>
          <div className="space-y-2">
            {leaks.strengths.map((st) => (
              <LeakRow key={st.type} leak={st} tradesById={tradesById} currency={currency} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
