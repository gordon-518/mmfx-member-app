"use client";

import { useEffect, useState } from "react";
import { distanceToLine, formatGap, formatLevel, inWatchZone } from "@/lib/fa/format";
import type { LineDistance, TheLine } from "@/lib/fa/format";
import { useT } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { rich } from "@/i18n/rich";
import type { Messages } from "@/i18n/messages/types";

// Spot + THE LINE, the two numbers that move. One component owns them because
// the distance is derived from the price, so they must share a single poll.
//
// The poll goes to our own /api/fundamental/price (member-gated, server-side
// proxy) — the browser never talks to the desk directly.

const POLL_MS = 30_000;

/** Where spot sits against THE LINE, as one sentence in the reader's language. */
function distanceSentence(live: Messages["fundamental"]["live"], d: LineDistance, level: number): string {
  const vars = { gap: formatGap(d.absolute, level), pct: d.pct.toFixed(2) };
  if (d.side === "at") return fmt(live.spotAt, vars);
  if (d.side === "above") return fmt(d.intact ? live.spotAbove : live.spotAboveBroken, vars);
  return fmt(d.intact ? live.spotBelow : live.spotBelowBroken, vars);
}

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
  const words = useT().fundamental.live;
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
            {fmt(words.spot, { instrument: display })}
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
            ? fmt(words.live, { s: POLL_MS / 1000 })
            : pollFailed
              ? words.pollFailed
              : words.asAtThesis}
        </p>
      </div>

      {/* THE LINE — the level that falsifies the thesis. */}
      <div
        className="rise relative overflow-hidden rounded-2xl border border-orange/30 bg-gradient-to-b from-[#FFF7F1] to-card p-5 shadow-soft"
        style={{ animationDelay: "0.14s" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-orange">
          {words.lineEyebrow}
        </p>
        {line ? (
          <>
            <p className="mt-1.5 text-[13px] leading-relaxed text-subtle">
              {rich(fmt(words.holds, { level: formatLevel(line.level) }), {
                side: (
                  <span className="font-semibold text-ink">
                    {line.holds === "above" ? words.sideAbove : words.sideBelow}
                  </span>
                ),
              })}
            </p>
            <p className="mt-3 font-display text-4xl font-bold tracking-tight text-ink tabular-nums">
              {formatLevel(line.level)}
            </p>
            {distance && (
              <p className="mt-2 text-[13px] font-medium text-subtle tabular-nums">
                {distanceSentence(words, distance, line.level)}
              </p>
            )}
            {inZone && watchZone && (
              <p className="mt-1.5 text-[13px] font-medium text-accent-ink">
                {fmt(words.inZone, { low: formatLevel(watchZone[0]), high: formatLevel(watchZone[1]) })}
              </p>
            )}
          </>
        ) : (
          <p className="mt-1.5 text-[13px] leading-relaxed text-subtle">{words.noLevel}</p>
        )}
      </div>
    </>
  );
}
