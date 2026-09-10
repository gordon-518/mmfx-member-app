// Stable keys for every gated feature (conversion-fix 1.3).
//
// Phase 1 uses them to name feature_view events. Task 2.2's access map
// (src/lib/access/features.ts) keys off this same list, so the events and the
// gating agree on names — rename one and you rename both.
export const FEATURE_KEYS = [
  "calendar",
  "news",
  "know-your-style",
  "daily-analysis",
  "course",
  "library",
  "indicators",
  "strategies",
  "signals",
  "live-classes",
  "fundamental-desk",
  "ai-trading-assistant",
  "team-mm",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
