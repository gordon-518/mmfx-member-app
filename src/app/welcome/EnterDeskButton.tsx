"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Marks the roadmap as seen (user_metadata.roadmap_seen) so the proxy first-run
// gate stops redirecting here, then heads to the dashboard.
export function EnterDeskButton() {
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

  return (
    <button
      type="button"
      onClick={enter}
      disabled={loading}
      className="group inline-flex items-center gap-2 rounded-xl bg-orange px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? "Opening…" : "Enter your desk"}
      {!loading && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="transition-transform group-hover:translate-x-0.5">
          <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
