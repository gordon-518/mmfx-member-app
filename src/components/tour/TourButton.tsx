"use client";

import { useEffect } from "react";
import { SparkIcon } from "@/components/icons";
import { startTour } from "./startTour";

/** Replay the tour. Lives at the top of Start here, so it's always findable. */
export function TourButton({ seen }: { seen: boolean }) {
  return (
    <button
      type="button"
      onClick={startTour}
      className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line-strong bg-card px-3.5 py-2 text-[13px] font-semibold text-ink shadow-soft transition-all hover:border-orange/45 hover:bg-accent-soft/50 hover:text-accent-ink"
    >
      <SparkIcon width={15} height={15} className="text-orange" />
      {seen ? "Take the tour again" : "How to use the app"}
    </button>
  );
}

/**
 * First visit only: run the tour without being asked. Scoped to Start here —
 * the page new members are sent to — and gated on the same user_metadata flag
 * the button writes, so nobody is shown it twice.
 */
export function TourAutoStart() {
  useEffect(() => {
    const t = window.setTimeout(startTour, 600);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
