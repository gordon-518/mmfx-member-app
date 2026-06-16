"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

export interface AnalysisEntry {
  id: string;
  published_on: string;
  title: string;
  gumlet_id: string;
  description: string | null;
  bias: "bullish" | "bearish" | "neutral" | null;
  session_tag: string | null;
  cover_url: string | null;
  has_report: boolean;
}

type BiasFilter = "all" | "bullish" | "bearish" | "neutral";
type GroupBy = "month" | "session";

// Bias badge colour: bullish = orange/peach, bearish = ink, neutral = subtle.
function biasClass(bias: AnalysisEntry["bias"]): string {
  if (bias === "bullish") return "bg-accent-soft text-accent-ink";
  if (bias === "bearish") return "bg-ink/5 text-ink";
  return "bg-paper text-subtle";
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function weekday(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : WEEKDAYS[d.getUTCDay()];
}
function monthLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? "Undated"
    : d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

interface Group {
  key: string;
  label: string;
  items: AnalysisEntry[];
}

// Bucket in first-appearance order. Input is newest-first, so months come out
// newest-first and sessions order by their most-recent entry.
function bucket(items: AnalysisEntry[], groupBy: GroupBy): Group[] {
  const map = new Map<string, Group>();
  for (const e of items) {
    const key = groupBy === "month" ? monthLabel(e.published_on) : e.session_tag ?? "Other sessions";
    if (!map.has(key)) map.set(key, { key, label: key, items: [] });
    map.get(key)!.items.push(e);
  }
  return [...map.values()];
}

const BIASES: BiasFilter[] = ["all", "bullish", "bearish", "neutral"];

export function DailyAnalysisClient({ entries }: { entries: AnalysisEntry[] }) {
  const [activeId, setActiveId] = useState<string>(entries[0]?.id ?? "");
  const [biasFilter, setBiasFilter] = useState<BiasFilter>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("month");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const playerRef = useRef<HTMLDivElement>(null);

  const active = entries.find((e) => e.id === activeId) ?? entries[0];
  const filtered = entries.filter((e) => biasFilter === "all" || e.bias === biasFilter);
  const groups = bucket(filtered, groupBy);

  // Open the first group; re-seed when the grouping dimension changes.
  useEffect(() => {
    setOpen(new Set(groups.length ? [groups[0].key] : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy]);

  function play(id: string) {
    setActiveId(id);
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function toggle(key: string) {
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-5 pb-10 pt-6 sm:px-8">
      {/* Player — only the selected entry's iframe is mounted. */}
      {active && (
        <div ref={playerRef} className="scroll-mt-6">
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-line bg-ink shadow-soft">
            <iframe
              key={active.gumlet_id}
              src={`https://play.gumlet.io/embed/${active.gumlet_id}`}
              title={active.title}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-faint">
              {weekday(active.published_on)} · {active.published_on}
            </span>
            {active.session_tag && (
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-ink">
                {active.session_tag}
              </span>
            )}
            {active.bias && (
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${biasClass(active.bias)}`}>
                {active.bias}
              </span>
            )}
          </div>
          <h2 className="mt-2 font-display text-xl font-bold tracking-tight text-ink">{active.title}</h2>
          {active.description && (
            <p className="mt-1.5 max-w-3xl text-[14px] leading-relaxed text-subtle">{active.description}</p>
          )}
          {active.has_report && (
            <a
              href={`/api/reports/${active.id}`}
              className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-accent-soft px-4 py-2.5 text-[13px] font-semibold text-accent-ink transition-colors hover:bg-orange hover:text-white"
            >
              Download report (PDF) ↓
            </a>
          )}
        </div>
      )}

      {/* Filter + group controls */}
      <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-line bg-card px-4 py-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-1.5">
          {BIASES.map((b) => {
            const on = biasFilter === b;
            return (
              <button
                key={b}
                type="button"
                onClick={() => setBiasFilter(b)}
                className={`cursor-pointer rounded-full px-3 py-1 text-[12px] font-semibold capitalize transition-colors ${
                  on ? "bg-orange text-white" : "bg-paper text-subtle hover:text-ink"
                }`}
              >
                {b === "all" ? "All" : b}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] font-medium text-faint">Group by</span>
          <div className="flex rounded-lg border border-line-strong p-0.5">
            {(["month", "session"] as GroupBy[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupBy(g)}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-[12px] font-semibold capitalize transition-colors ${
                  groupBy === g ? "bg-accent-soft text-accent-ink" : "text-subtle hover:text-ink"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-faint">
            {filtered.length} {filtered.length === 1 ? "read" : "reads"}
          </span>
        </div>
      </div>

      {/* Archive — grouped + collapsible */}
      <div className="mt-5 space-y-3">
        {groups.length === 0 && (
          <p className="rounded-2xl border border-line bg-card px-5 py-10 text-center text-[14px] text-subtle shadow-soft">
            No reads match that filter.
          </p>
        )}
        {groups.map((g) => {
          const isOpen = open.has(g.key);
          return (
            <section key={g.key}>
              <button
                type="button"
                onClick={() => toggle(g.key)}
                aria-expanded={isOpen}
                className="mb-2 flex w-full cursor-pointer items-center gap-2.5 px-1"
              >
                <span className="font-display text-[15px] font-bold tracking-tight text-ink">{g.label}</span>
                <span className="text-[11px] text-faint">{g.items.length} {g.items.length === 1 ? "read" : "reads"}</span>
                <span className="h-px flex-1 bg-line" />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className={`shrink-0 text-faint transition-transform ${isOpen ? "rotate-180" : ""}`}>
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {isOpen && (
                <ul className="space-y-2">
                  {g.items.map((e) => {
                    const isActive = e.id === active?.id;
                    return (
                      <li
                        key={e.id}
                        className={`flex items-center gap-3 overflow-hidden rounded-xl border bg-card p-2 shadow-soft transition-all ${
                          isActive ? "border-orange/40 ring-1 ring-orange/15" : "border-line hover:border-orange/30 hover:shadow-soft-lg"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => play(e.id)}
                          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                          aria-label={`Watch ${e.title}`}
                        >
                          <span className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-md bg-accent-soft">
                            {e.cover_url ? (
                              <Image src={e.cover_url} alt="" fill sizes="80px" className="object-cover" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-accent-ink">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7L8 5Z" /></svg>
                              </span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-semibold tracking-tight text-ink">{e.title}</span>
                            <span className="mt-0.5 block text-[11px] text-faint">{weekday(e.published_on)} · {e.published_on}</span>
                          </span>
                        </button>
                        {e.session_tag && (
                          <span className="hidden shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent-ink sm:inline">
                            {e.session_tag}
                          </span>
                        )}
                        {e.bias && (
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${biasClass(e.bias)}`}>
                            {e.bias}
                          </span>
                        )}
                        {e.has_report && (
                          <a
                            href={`/api/reports/${e.id}`}
                            className="flex shrink-0 cursor-pointer items-center justify-center rounded-lg px-1.5 py-1 text-accent-ink transition-colors hover:text-orange"
                            title="Download report (PDF)"
                            aria-label="Download report"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                              <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                            </svg>
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
