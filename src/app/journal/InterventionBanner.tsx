"use client";

import { useState } from "react";
import Link from "next/link";
import type { Intervention } from "@/lib/journal/interventions";

// Shows the single most-severe banner-channel intervention. Interventions are
// decided server-side (deterministic `now`) and passed in.
export function InterventionBanner({ interventions }: { interventions: Intervention[] }) {
  const [dismissed, setDismissed] = useState(false);
  const banner = interventions
    .filter((i) => i.channels.includes("banner"))
    .sort(
      (a, b) =>
        (a.severity === "critical" ? -1 : 1) - (b.severity === "critical" ? -1 : 1)
    )[0];
  if (!banner || dismissed) return null;

  const critical = banner.severity === "critical";
  return (
    <div
      className={`rise mb-6 flex items-start gap-3 rounded-2xl border p-4 shadow-soft ${
        critical ? "border-red-300 bg-red-50" : "border-orange/30 bg-accent-soft/40"
      }`}
    >
      <span className={`mt-0.5 text-lg ${critical ? "text-red-600" : "text-orange"}`}>
        {critical ? "⚠" : "✦"}
      </span>
      <div className="flex-1">
        <p className={`text-[15px] font-bold ${critical ? "text-red-800" : "text-ink"}`}>
          {banner.headline}
        </p>
        {banner.body && <p className="mt-0.5 text-[13px] text-ink/80">{banner.body}</p>}
        <p className="mt-1 text-[13px] font-semibold text-ink">
          → {banner.action}{" "}
          <Link href="/journal#discipline" className="text-accent-ink underline">
            Review
          </Link>
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-lg px-2 py-1 text-[13px] text-subtle hover:text-ink"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
