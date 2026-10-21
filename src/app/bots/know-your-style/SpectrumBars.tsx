"use client";

import { motion, useReducedMotion } from "framer-motion";
import { DIMENSIONS, rankDimensions, strongestDimensions, weakestDimensions } from "@/lib/kys/dimensions";
import type { DimensionScores } from "@/lib/kys/types";

// The six-dimension profile. Weakest first: the leaks lead, the strengths
// anchor the bottom, so the shape reads top-down as "fix this, keep that".

/** Colour band by score: low = leak, mid = warning, high = strength. */
function band(score: number): { fill: string; marker: string } {
  if (score <= 40) return { fill: "rgba(217,83,26,0.85)", marker: "#d9531a" };
  if (score <= 64) return { fill: "rgba(224,137,46,0.75)", marker: "#e0892e" };
  return { fill: "rgba(78,154,91,0.65)", marker: "#4e9a5b" };
}

const BY_ID = Object.fromEntries(DIMENSIONS.map((d) => [d.id, d]));

export function SpectrumBars({ scores }: { scores: DimensionScores }) {
  const reduce = useReducedMotion();
  const weak = new Set(weakestDimensions(scores, 2));
  const strong = new Set(strongestDimensions(scores, 2));

  return (
    <div className="space-y-4">
      {rankDimensions(scores).map(({ id, score }, i) => {
        const d = BY_ID[id];
        const c = band(score);
        const isLeak = weak.has(id) && score <= 50;
        const isStrength = strong.has(id) && score >= 60;
        const transition = { duration: reduce ? 0 : 0.9, ease: [0.2, 0.8, 0.2, 1] as const, delay: reduce ? 0 : 0.1 + i * 0.07 };
        return (
          <div key={id}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="font-display text-[13.5px] font-bold text-ink">{d.name}</span>
              {isLeak && (
                <span className="rounded bg-orange px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                  Your leak
                </span>
              )}
              {isStrength && (
                <span className="rounded bg-[#dbefd8] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#2f6b39]">
                  Strength
                </span>
              )}
              <span className="ml-auto font-mono text-[12px] text-faint">{score} / 100</span>
            </div>

            <div className="relative h-2 rounded-full bg-line">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: c.fill }}
                initial={{ width: reduce ? `${score}%` : 0 }}
                animate={{ width: `${score}%` }}
                transition={transition}
              />
              <motion.div
                className="absolute top-1/2 h-[17px] w-[17px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card shadow-soft"
                style={{ background: c.marker }}
                initial={{ left: reduce ? `${score}%` : 0 }}
                animate={{ left: `${score}%` }}
                transition={transition}
              />
            </div>

            <div className="mt-1.5 flex justify-between text-[11px]">
              <span className="font-medium text-accent-ink">{d.lowPole}</span>
              <span className="text-faint">{d.highPole}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
