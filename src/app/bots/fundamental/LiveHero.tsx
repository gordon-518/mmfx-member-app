"use client";

import { useEffect, useState } from "react";
import { distanceToLine, formatGap, formatLevel, inWatchZone } from "@/lib/fa/format";
import type { TheLine } from "@/lib/fa/format";

// Spot + THE LINE, the two numbers that move. One component owns them because
// the distance is derived from the price, so they must share a single poll.
//
// The poll goes to our own /api/fundamental/price (member-gated, server-side
// proxy) — the browser never talks to the desk directly.

const POLL_MS = 30_000;

export function LiveHero({
  instrument,
  display,
  thesisPrice,
  line,
  watchZone,
}: {
  instrument: string;
  display: string;
  /** price_context.current — what spot was when the thesis was written. */
  thesisPrice: number;
  line: TheLine | null;
  watchZone: [number, number] | null;
}) {
  const [price, setPrice] = useState(thesisPrice);
  const [live, setLive] = useState(false);
  // Only flagged once a poll has actually failed — never on the first paint.
  const [pollFailed, setPollFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function poll() {
      // A hidden tab doesn't need a fresh quote; it refreshes on return.
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(
          `/api/fundamental/price?instrument=${encodeURIComponent(instrument)}`,
          { signal: controller.signal, cache: "no-store" }
        );
        const json = (await res.json()) as { ok?: boolean; price?: number };
        if (cancelled) return;
        if (res.ok && json.ok && typeof json.price === "number") {
          setPrice(json.price);
          setLive(true);
          setPollFailed(false);
        } else {
          setPollFailed(true);
        }
      } catch {
        // Aborted on unmount, offline, or the desk is down: keep the last
        // known price on screen and say it isn't live.
        if (!cancelled) setPollFailed(true);
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [instrument]);

  const distance = distanceToLine(price, line);
  const inZone = inWatchZone(price, watchZone);

  return (
    <>
      {/* Spot */}
      <div
        className="rise flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-line bg-card p-5 shadow-soft"
        style={{ animationDelay: "0.08s" }}
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
            {display} · spot
          </p>
          <p className="mt-1 font-display text-4xl font-bold tracking-tight text-ink tabular-nums">
            {formatLevel(price)}
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-[12px] font-medium text-subtle">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ring-2 ${
              live && !pollFailed
                ? "bg-green-500 ring-green-500/15"
                : "bg-faint ring-faint/20"
            }`}
          />
          {live && !pollFailed
            ? "Live · updates every 30s"
            : pollFailed
              ? "Live price unavailable — showing the last known level"
              : "As at the thesis"}
        </p>
      </div>

      {/* THE LINE — the level that falsifies the thesis. */}
      <div
        className="rise relative overflow-hidden rounded-2xl border border-orange/30 bg-gradient-to-b from-[#FFF7F1] to-card p-5 shadow-soft"
        style={{ animationDelay: "0.14s" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-orange">
          Invalidation · the line
        </p>
        {line ? (
          <>
            <p className="mt-1.5 text-[13px] leading-relaxed text-subtle">
              This read holds while price stays{" "}
              <span className="font-semibold text-ink">{line.holds}</span>{" "}
              {formatLevel(line.level)}.
            </p>
            <p className="mt-3 font-display text-4xl font-bold tracking-tight text-ink tabular-nums">
              {formatLevel(line.level)}
            </p>
            {distance && (
              <p className="mt-2 text-[13px] font-medium text-subtle tabular-nums">
                Spot is {formatGap(distance.absolute, line.level)} ({distance.pct.toFixed(2)}%){" "}
                {distance.side === "at" ? "exactly at" : `${distance.side}`} the line
                {distance.intact ? "" : " — the desk re-reads the thesis when a break holds"}
                .
              </p>
            )}
            {inZone && watchZone && (
              <p className="mt-1.5 text-[13px] font-medium text-accent-ink">
                Spot is inside the watch zone ({formatLevel(watchZone[0])} —{" "}
                {formatLevel(watchZone[1])}).
              </p>
            )}
          </>
        ) : (
          <p className="mt-1.5 text-[13px] leading-relaxed text-subtle">
            This thesis carries no hard level — read the invalidation contract below.
          </p>
        )}
      </div>
    </>
  );
}
