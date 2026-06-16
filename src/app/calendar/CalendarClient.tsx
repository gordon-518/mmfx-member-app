"use client";

import { useEffect, useState } from "react";
import type { CalEvent, Impact } from "@/lib/forexNews";

const IMPACT_STYLE: Record<Impact, string> = {
  High: "bg-[#FCEBEB] text-[#A32D2D]",
  Medium: "bg-[#FAEEDA] text-[#854F0B]",
  Low: "bg-paper text-subtle",
};

const CCY_ORDER = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD"];

// Trading-relevant zones. The viewer's own zone is added on mount if missing.
const TZ_OPTIONS: { label: string; value: string }[] = [
  { label: "GMT / UTC", value: "Etc/UTC" },
  { label: "London", value: "Europe/London" },
  { label: "Frankfurt", value: "Europe/Berlin" },
  { label: "New York", value: "America/New_York" },
  { label: "Chicago", value: "America/Chicago" },
  { label: "Los Angeles", value: "America/Los_Angeles" },
  { label: "Dubai", value: "Asia/Dubai" },
  { label: "Mumbai", value: "Asia/Kolkata" },
  { label: "Singapore", value: "Asia/Singapore" },
  { label: "Tokyo", value: "Asia/Tokyo" },
  { label: "Sydney", value: "Australia/Sydney" },
];

// tz-aware, deterministic formatters.
function fmtTime(d: string, tz: string): string {
  const t = new Date(d);
  return Number.isNaN(t.getTime())
    ? ""
    : t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz });
}
function dayKey(d: string, tz: string): string {
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? "" : t.toLocaleDateString("en-CA", { timeZone: tz });
}
function dayLabel(d: string, tz: string): string {
  const t = new Date(d);
  return Number.isNaN(t.getTime())
    ? ""
    : t.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: tz });
}

export function CalendarClient({ events }: { events: CalEvent[] }) {
  const [ccy, setCcy] = useState<string>("all");
  const [highOnly, setHighOnly] = useState(false);
  // Start in UTC so SSR and first client render match; snap to the viewer's
  // own zone after mount.
  const [tz, setTz] = useState<string>("Etc/UTC");

  useEffect(() => {
    try {
      const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (local) setTz(local);
    } catch {
      /* keep UTC */
    }
  }, []);

  // Ensure the active zone is always selectable in the dropdown.
  const tzOptions = TZ_OPTIONS.some((o) => o.value === tz)
    ? TZ_OPTIONS
    : [{ label: `Local · ${tz}`, value: tz }, ...TZ_OPTIONS];

  const currencies = [...new Set(events.map((e) => e.currency).filter(Boolean))].sort((a, b) => {
    const ia = CCY_ORDER.indexOf(a);
    const ib = CCY_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });

  const filtered = events.filter(
    (e) => (ccy === "all" || e.currency === ccy) && (!highOnly || e.importance === "High")
  );

  const days: { key: string; label: string; items: CalEvent[] }[] = [];
  for (const e of filtered) {
    const key = dayKey(e.date, tz);
    let g = days[days.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: dayLabel(e.date, tz), items: [] };
      days.push(g);
    }
    g.items.push(e);
  }

  return (
    <>
      {/* Filters */}
      <div className="rise mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-line bg-card px-4 py-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCcy("all")}
            className={`cursor-pointer rounded-full px-3 py-1 text-[12px] font-semibold transition-colors ${
              ccy === "all" ? "bg-orange text-white" : "bg-paper text-subtle hover:text-ink"
            }`}
          >
            All
          </button>
          {currencies.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCcy(c)}
              className={`cursor-pointer rounded-full px-3 py-1 text-[12px] font-semibold transition-colors ${
                ccy === c ? "bg-orange text-white" : "bg-paper text-subtle hover:text-ink"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setHighOnly((v) => !v)}
            className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors ${
              highOnly ? "border-orange/40 bg-accent-soft text-accent-ink" : "border-line-strong text-subtle hover:text-ink"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${highOnly ? "bg-orange" : "bg-line-strong"}`} /> High only
          </button>
          <select
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            aria-label="Time zone"
            className="cursor-pointer rounded-lg border border-line-strong bg-card px-2.5 py-1 text-[12px] font-semibold text-ink focus:border-orange/40 focus:outline-none"
          >
            {tzOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Calendar by day */}
      <div className="rise mt-5 space-y-5">
        {days.length === 0 && (
          <p className="rounded-2xl border border-line bg-card px-5 py-10 text-center text-[14px] text-subtle shadow-soft">
            No events match that filter this week.
          </p>
        )}
        {days.map((d) => (
          <section key={d.key}>
            <div className="mb-2 flex items-center gap-2.5 px-1">
              <span className="font-display text-[15px] font-bold tracking-tight text-ink">{d.label}</span>
              <span className="text-[11px] text-faint">{d.items.length} {d.items.length === 1 ? "event" : "events"}</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-soft">
              {d.items.map((e, i) => (
                <div
                  key={`${e.event}-${e.date}-${i}`}
                  className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}
                >
                  <span className="w-12 shrink-0 text-[12px] font-medium tabular-nums text-faint">{fmtTime(e.date, tz)}</span>
                  <span className="w-10 shrink-0 rounded-md bg-accent-soft px-1.5 py-0.5 text-center text-[10px] font-bold text-accent-ink">
                    {e.currency}
                  </span>
                  <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide sm:inline ${IMPACT_STYLE[e.importance]}`}>
                    {e.importance}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{e.event}</span>
                  <span className="hidden shrink-0 items-center gap-3 text-[11px] text-faint sm:flex">
                    {e.actual != null && <span className="font-semibold text-ink">A {e.actual}</span>}
                    {e.forecast != null && <span>F {e.forecast}</span>}
                    {e.previous != null && <span>P {e.previous}</span>}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
