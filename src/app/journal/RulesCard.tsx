"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Breach, RulesResult } from "@/lib/journal/rules";
import type { JournalRulesConfig, JournalTradeRow } from "@/lib/journal/types";

// Discipline rules editor + per-rule adherence + breach log. The discipline
// score itself now lives in the hero ring (JournalHero); this card owns the
// rules the score is measured against. PUT /api/journal/rules → router.refresh().

const SESSIONS = ["London", "New York", "Asian"] as const;

function BreachRow({
  breach,
  tradesById,
}: {
  breach: Breach;
  tradesById: Map<string, JournalTradeRow>;
}) {
  const [open, setOpen] = useState(false);
  const when = breach.when.slice(0, 10);
  return (
    <div className="rounded-xl border border-line p-3">
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <p className="text-[14px] font-semibold text-ink">{breach.title}</p>
          <p className="text-[12px] text-subtle">{breach.detail}</p>
        </div>
        <span className="shrink-0 pl-3 text-[12px] text-subtle">{when}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1 border-t border-line pt-2 text-[12px]">
          {breach.tradeIds.map((id) => {
            const t = tradesById.get(id);
            if (!t) return null;
            return (
              <div key={id} className="flex justify-between text-subtle">
                <span>
                  {t.symbol} {t.direction} · {t.volume} lots ·{" "}
                  {t.close_time ? new Date(t.close_time).toLocaleDateString() : ""}
                </span>
                <span className={t.net_profit < 0 ? "text-red-600" : "text-emerald-600"}>
                  {t.net_profit < 0 ? "−" : "+"}$
                  {Math.abs(t.net_profit).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Editor -----------------------------------------------------------------

type Draft = JournalRulesConfig;

const inputCls =
  "w-24 rounded-lg border border-line-strong bg-card px-2 py-1 text-[13px] text-ink focus:border-orange/60 focus:outline-none";

function NumRule({
  label,
  hint,
  rule,
  set,
  suffix,
  pctToggle,
}: {
  label: string;
  hint?: string;
  rule: { enabled?: boolean; value?: number; is_pct?: boolean } | undefined;
  set: (v: { enabled: boolean; value?: number; is_pct?: boolean }) => void;
  suffix?: string;
  pctToggle?: boolean;
}) {
  const enabled = !!rule?.enabled;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 py-2.5">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => set({ ...rule, enabled: e.target.checked })}
          className="h-4 w-4 accent-orange"
        />
        <span className="text-[13px] font-medium text-ink">{label}</span>
        {hint && <span className="text-[11px] text-subtle">{hint}</span>}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          step="any"
          value={rule?.value ?? ""}
          disabled={!enabled}
          onChange={(e) =>
            set({ ...rule, enabled, value: e.target.value === "" ? undefined : Number(e.target.value) })
          }
          className={`${inputCls} disabled:opacity-40`}
        />
        {pctToggle ? (
          <button
            type="button"
            disabled={!enabled}
            onClick={() => set({ ...rule, enabled, is_pct: !rule?.is_pct })}
            className="rounded-lg border border-line-strong px-2 py-1 text-[12px] font-semibold text-ink disabled:opacity-40"
          >
            {rule?.is_pct ? "%" : "$"}
          </button>
        ) : (
          suffix && <span className="text-[12px] text-subtle">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function RulesEditor({
  config,
  onClose,
}: {
  config: JournalRulesConfig;
  onClose: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(config);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (k: keyof Draft, v: unknown) => setDraft((d) => ({ ...d, [k]: v }));
  const sessions = draft.allowed_sessions?.value ?? [];

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/journal/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "Could not save rules");
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-paper/50 p-4">
      <NumRule
        label="Max daily loss"
        rule={draft.max_daily_loss}
        set={(v) => patch("max_daily_loss", v)}
        pctToggle
      />
      <NumRule
        label="Max trades per day"
        rule={draft.max_trades_per_day}
        set={(v) => patch("max_trades_per_day", v)}
        suffix="trades"
      />
      <NumRule
        label="Stop after N losses in a row"
        rule={draft.max_consec_losses}
        set={(v) => patch("max_consec_losses", v)}
        suffix="losses"
      />
      <NumRule
        label="Max position size"
        rule={draft.max_lots}
        set={(v) => patch("max_lots", v)}
        suffix="lots"
      />
      <div className="flex items-center gap-2 border-t border-line/60 py-2.5">
        <input
          type="checkbox"
          checked={!!draft.instruments_only?.enabled}
          onChange={(e) => patch("instruments_only", { enabled: e.target.checked })}
          className="h-4 w-4 accent-orange"
        />
        <span className="text-[13px] font-medium text-ink">Trade only my instruments</span>
        <span className="text-[11px] text-subtle">(from your goals)</span>
      </div>
      <div className="border-t border-line/60 py-2.5">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!draft.allowed_sessions?.enabled}
            onChange={(e) =>
              patch("allowed_sessions", { enabled: e.target.checked, value: sessions })
            }
            className="h-4 w-4 accent-orange"
          />
          <span className="text-[13px] font-medium text-ink">Trade only these sessions</span>
        </label>
        <div className="mt-2 flex flex-wrap gap-2 pl-6">
          {SESSIONS.map((s) => {
            const on = sessions.includes(s);
            return (
              <button
                key={s}
                type="button"
                disabled={!draft.allowed_sessions?.enabled}
                onClick={() =>
                  patch("allowed_sessions", {
                    enabled: true,
                    value: on ? sessions.filter((x) => x !== s) : [...sessions, s],
                  })
                }
                className={`rounded-full px-3 py-1 text-[12px] font-semibold disabled:opacity-40 ${
                  on ? "bg-orange text-white" : "border border-line-strong text-ink"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="cursor-pointer rounded-lg bg-orange px-4 py-2 text-[13px] font-semibold text-white transition-all hover:bg-[#f24e12] disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save rules"}
        </button>
        <button
          onClick={onClose}
          className="cursor-pointer rounded-lg border border-line-strong px-4 py-2 text-[13px] font-semibold text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// --- Card -------------------------------------------------------------------

export function RulesCard({
  rules,
  config,
  trades,
}: {
  rules: RulesResult;
  config: JournalRulesConfig;
  trades: JournalTradeRow[];
}) {
  const [editing, setEditing] = useState(false);
  const tradesById = new Map(trades.map((t) => [t.id, t]));
  const hasRules = rules.perRule.length > 0;

  return (
    <section id="rules" className="rounded-2xl border border-line bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-ink">Discipline rules</h2>
        <button
          onClick={() => setEditing((e) => !e)}
          className="text-[13px] font-semibold text-accent-ink hover:underline"
        >
          {editing ? "Close" : hasRules ? "Edit rules" : "Set rules"}
        </button>
      </div>

      {hasRules ? (
        <>
          <div className="mt-4 space-y-1.5">
            {rules.perRule.map((p) => (
              <div key={p.rule} className="flex items-center justify-between text-[13px]">
                <span className="text-ink">{p.title}</span>
                {p.inert ? (
                  <span className="text-[12px] text-amber-700">set instruments in goals</span>
                ) : (
                  <span
                    className={`font-semibold ${
                      p.breachCount === 0 ? "text-emerald-600" : "text-amber-600"
                    }`}
                  >
                    {p.kept}/{p.total} {p.unit}s clean
                    {p.breachCount > 0
                      ? ` · ${p.breachCount} break${p.breachCount > 1 ? "s" : ""}`
                      : ""}
                  </span>
                )}
              </div>
            ))}
          </div>

          {rules.breaches.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-subtle">
                Recent breaks
              </p>
              <div className="space-y-2">
                {rules.breaches.slice(0, 8).map((b, i) => (
                  <BreachRow key={`${b.rule}-${b.when}-${i}`} breach={b} tradesById={tradesById} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        !editing && (
          <p className="mt-3 text-[14px] leading-relaxed text-subtle">
            Set your own trading rules — a daily loss cap, a trade limit, position
            size, sessions. The journal checks your synced trades against them and
            builds your discipline score and streak.
          </p>
        )
      )}

      {editing && <RulesEditor config={config} onClose={() => setEditing(false)} />}
    </section>
  );
}
