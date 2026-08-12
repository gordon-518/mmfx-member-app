"use client";

import { useState } from "react";

// Small ⓘ affordance that reveals a short explanation of how a metric is
// derived. Click to toggle; blur to dismiss. `align="right"` anchors the popover
// to the icon's right edge so it opens leftward — use it on right-column cards
// where a left-anchored popover would overflow the viewport on mobile.
export function InfoTip({
  text,
  label,
  align = "left",
}: {
  text: string;
  label?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label ?? "How this is calculated"}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-line-strong text-[9px] font-bold leading-none text-subtle transition-colors hover:border-orange hover:text-orange"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute top-5 z-30 w-56 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-card p-2.5 text-[11px] font-normal normal-case leading-relaxed tracking-normal text-subtle shadow-soft-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
