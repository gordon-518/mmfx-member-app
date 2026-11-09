import type { FeatureKey } from "@/lib/access/featureKeys";

// The feature videos (VSLs), one minute each, in two cuts: 16:9 for wide
// screens and 4:5 for phones. They live once, in the public `vsl` bucket of
// this project's Supabase storage, and this app and the marketing site both
// play them from there — nothing committed to either repo, and nothing a
// deploy can drop (the first AI Trading Assistant video was served from the
// marketing site and vanished with a later deploy of it).
//
// Paths carry a version (v1/…): a re-cut goes to v2 and this file changes, so
// a browser never holds an old cut under a new name.

export const VSL_KEYS = [
  "fundamental-desk",
  "strategies",
  "backtest",
  "ai-trading-assistant",
  "ebook-library",
  "signals",
  "course",
  "your-float",
  "indicators",
  "news",
  "team-mm",
  "know-your-style",
] as const;

export type VslKey = (typeof VSL_KEYS)[number];

export interface VslSources {
  /** 16:9, 1920×1080. */
  wide: string;
  /** 4:5, 864×1080 — what a phone plays. */
  tall: string;
}

const VERSION = "v1";

export function vslSources(key: VslKey, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""): VslSources {
  const base = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/vsl/${VERSION}`;
  return { wide: `${base}/${key}-16x9.mp4`, tall: `${base}/${key}-4x5.mp4` };
}

/** Which video sells a feature, on its locked page and in its page's tour. */
export const FEATURE_VSL: Partial<Record<FeatureKey, VslKey>> = {
  "fundamental-desk": "fundamental-desk",
  strategies: "strategies",
  "ai-trading-assistant": "ai-trading-assistant",
  library: "ebook-library",
  signals: "signals",
  course: "course",
  indicators: "indicators",
  news: "news",
  calendar: "news",
  "team-mm": "team-mm",
  "know-your-style": "know-your-style",
};
