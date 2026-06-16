"use client";

import { useState } from "react";
import { ExternalIcon } from "@/components/icons";
import type { NewsItem, Sentiment } from "@/lib/forexNews";

type SentFilter = "all" | Sentiment;
const SENTS: SentFilter[] = ["all", "Positive", "Negative", "Neutral"];

// Restrained semantic colours for sentiment (bullish/bearish/neutral) — kept
// soft so they sit inside the warm-premium palette.
const SENT_STYLE: Record<Sentiment, string> = {
  Positive: "bg-[#E1F5EE] text-[#0F6E56]",
  Negative: "bg-[#FCEBEB] text-[#A32D2D]",
  Neutral: "bg-paper text-subtle",
};

function fmtDate(d: string): string {
  const t = new Date(d);
  return Number.isNaN(t.getTime())
    ? ""
    : t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function NewsFeed({ items }: { items: NewsItem[] }) {
  const [sent, setSent] = useState<SentFilter>("all");

  const filtered = items.filter((i) => sent === "all" || i.sentiment === sent);

  return (
    <>
      {/* Sentiment filter (the pair filter lives in the page) */}
      <div className="rise mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-line bg-card px-4 py-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-1.5">
          {SENTS.map((s) => {
            const on = sent === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSent(s)}
                className={`cursor-pointer rounded-full px-3 py-1 text-[12px] font-semibold capitalize transition-colors ${
                  on ? "bg-orange text-white" : "bg-paper text-subtle hover:text-ink"
                }`}
              >
                {s === "all" ? "All" : s}
              </button>
            );
          })}
        </div>
        <span className="ml-auto text-[11px] text-faint">{filtered.length} articles</span>
      </div>

      {/* Feed */}
      <div className="rise mt-5 space-y-3">
        {filtered.length === 0 && (
          <p className="rounded-2xl border border-line bg-card px-5 py-10 text-center text-[14px] text-subtle shadow-soft">
            No articles match that filter.
          </p>
        )}
        {filtered.map((n) => (
          <a
            key={n.url}
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-2xl border border-line bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-orange/30 hover:shadow-soft-lg"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-[12px] font-semibold text-ink">{n.source}</span>
              <span className="text-[11px] text-faint">{fmtDate(n.date)}</span>
              {n.type === "Video" && (
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent-ink">
                  Video
                </span>
              )}
              <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SENT_STYLE[n.sentiment]}`}>
                {n.sentiment}
              </span>
            </div>
            <h3 className="mt-2 font-display text-[16px] font-bold leading-snug tracking-tight text-ink group-hover:text-accent-ink">
              {n.title}
            </h3>
            {n.text && n.text !== n.title && (
              <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-subtle">{n.text}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {n.topics.slice(0, 4).map((t) => (
                <span key={t} className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-medium text-subtle">
                  {t}
                </span>
              ))}
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-orange opacity-0 transition-opacity group-hover:opacity-100">
                Read <ExternalIcon width={12} height={12} />
              </span>
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
