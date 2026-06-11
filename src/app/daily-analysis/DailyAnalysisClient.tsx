"use client";

import { useRef, useState } from "react";
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

// Bias badge colour per brand: bullish = orange, bearish = pearl, neutral = gray.
function biasClass(bias: AnalysisEntry["bias"]): string {
  if (bias === "bullish") return "border-orange/50 text-orange";
  if (bias === "bearish") return "border-pearl/40 text-pearl";
  return "border-muted/40 text-muted";
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function weekday(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : WEEKDAYS[d.getUTCDay()];
}

export function DailyAnalysisClient({ entries }: { entries: AnalysisEntry[] }) {
  const [activeId, setActiveId] = useState<string>(entries[0]?.id ?? "");
  const playerRef = useRef<HTMLDivElement>(null);
  const active = entries.find((e) => e.id === activeId) ?? entries[0];

  function play(id: string) {
    setActiveId(id);
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:px-10">
      {/* Single player — only the selected entry's iframe is mounted. */}
      {active && (
        <div ref={playerRef} className="scroll-mt-6">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-pearl/10 bg-obsidian">
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
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
              {weekday(active.published_on)} · {active.published_on}
            </span>
            {active.session_tag && (
              <span className="border border-orange/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-orange/90">
                {active.session_tag}
              </span>
            )}
            {active.bias && (
              <span
                className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] ${biasClass(
                  active.bias
                )}`}
              >
                {active.bias}
              </span>
            )}
          </div>
          <h2 className="mt-2 font-display text-xl font-semibold text-pearl">
            {active.title}
          </h2>
          {active.description && (
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted">
              {active.description}
            </p>
          )}
          {active.has_report && (
            <a
              href={`/api/reports/${active.id}`}
              className="mt-4 inline-flex items-center gap-2 border border-orange/60 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-orange transition-colors hover:bg-orange hover:text-black"
            >
              Download report (PDF) ↓
            </a>
          )}
        </div>
      )}

      {/* List — newest first */}
      <div className="mt-10 space-y-3">
        {entries.map((e) => {
          const isActive = e.id === active?.id;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => play(e.id)}
              className={`flex w-full items-stretch gap-4 overflow-hidden rounded-lg border bg-graphite/70 text-left transition-colors ${
                isActive ? "border-orange/60" : "border-pearl/10 hover:border-orange/40"
              }`}
            >
              <div className="relative aspect-video w-36 shrink-0 bg-obsidian">
                {e.cover_url ? (
                  <Image
                    src={e.cover_url}
                    alt=""
                    fill
                    sizes="144px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-mono text-base text-orange/70">
                    ▶
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 py-3 pr-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                    {weekday(e.published_on)} · {e.published_on}
                  </span>
                  {e.session_tag && (
                    <span className="border border-orange/30 px-1 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em] text-orange/80">
                      {e.session_tag}
                    </span>
                  )}
                  {e.bias && (
                    <span
                      className={`border px-1 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em] ${biasClass(
                        e.bias
                      )}`}
                    >
                      {e.bias}
                    </span>
                  )}
                </div>
                <h3 className="mt-1 truncate font-display text-base font-semibold text-pearl">
                  {e.title}
                </h3>
                {e.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">
                    {e.description}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
