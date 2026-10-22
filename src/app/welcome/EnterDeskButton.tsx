"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Getting out of here and into the app.
//
// The proxy's first-run gate (src/proxy.ts) bounces every page back to
// /welcome until user_metadata.roadmap_seen is set. That flag used to be
// written ONLY by the button at the bottom of this page, so a new member who
// clicked "Dashboard" in the sidebar landed back here, and the longer this
// page got the more it looked like the desk couldn't be entered at all
// (Gordon, 22 Oct). Seeing the roadmap is what the flag is named for, so
// MarkRoadmapSeen now sets it on arrival and the gate releases either way.

/** Sets roadmap_seen on arrival, so the first-run gate never traps anyone. */
export function MarkRoadmapSeen() {
  useEffect(() => {
    createClient()
      .auth.updateUser({ data: { roadmap_seen: true } })
      .catch(() => {
        /* the button below still writes it; a failure here is not fatal */
      });
  }, []);
  return null;
}

export function EnterDeskButton({ variant = "primary" }: { variant?: "primary" | "header" }) {
  const [loading, setLoading] = useState(false);

  async function enter() {
    setLoading(true);
    try {
      await createClient().auth.updateUser({ data: { roadmap_seen: true } });
    } catch {
      /* even if the flag write fails, let them through */
    }
    window.location.assign("/dashboard");
  }

  const arrow = !loading && (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="transition-transform group-hover:translate-x-0.5"
    >
      <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  if (variant === "header") {
    return (
      <button
        type="button"
        onClick={enter}
        disabled={loading}
        className="group inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange px-4 py-2 text-[13px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Opening…" : "Enter your desk"}
        {arrow}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={enter}
      disabled={loading}
      className="group inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? "Opening…" : "Enter your desk"}
      {arrow}
    </button>
  );
}
