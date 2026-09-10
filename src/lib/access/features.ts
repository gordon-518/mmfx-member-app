// The feature access map (conversion-fix 2.2): one source of truth for what
// each feature needs. Pure and client-safe — the server guard
// (requireFeature) and the nav's lock badges (AppShell) both read it, so the
// sidebar can never disagree with the page.
//
// Phase 2 has three levels: free (every signed-in user), full (a live trial or
// a member) and member (funded members only, as the AI Trading Assistant and
// Team MM already were). Phase 3 swaps full/member for the tier ladder here,
// without touching the pages again.

import type { AccessTier } from "@/lib/trial/status";
import type { FeatureKey } from "./featureKeys";

export type FeatureLevel = "free" | "full" | "member";

export const FEATURE_LEVEL: Readonly<Record<FeatureKey, FeatureLevel>> = {
  calendar: "free",
  news: "free",
  "know-your-style": "free",
  "daily-analysis": "free",
  // Free reaches Module 1 only; the per-lesson gate is src/lib/access/course.ts.
  course: "free",
  library: "full",
  indicators: "full",
  strategies: "full",
  signals: "full",
  "live-classes": "full",
  "fundamental-desk": "full",
  "ai-trading-assistant": "member",
  "team-mm": "member",
};

/** The route each feature lives at (its nav link). */
export const FEATURE_HREF: Readonly<Record<FeatureKey, string>> = {
  calendar: "/calendar",
  news: "/news",
  "know-your-style": "/bots/know-your-style",
  "daily-analysis": "/daily-analysis",
  course: "/course",
  library: "/library",
  indicators: "/indicators",
  strategies: "/strategies",
  signals: "/signals",
  "live-classes": "/live-classes",
  "fundamental-desk": "/bots/fundamental",
  "ai-trading-assistant": "/journal",
  "team-mm": "/team-mm",
};

export interface Viewer {
  tier: AccessTier;
  isMember: boolean;
  isAdmin: boolean;
}

/**
 * Whether this viewer may use the feature. `member` keeps the rule the journal
 * pages enforced before: Full access AND (a funded member OR an admin).
 */
export function canAccess(key: FeatureKey, viewer: Viewer): boolean {
  switch (FEATURE_LEVEL[key]) {
    case "free":
      return true;
    case "full":
      return viewer.tier === "Full";
    case "member":
      return viewer.tier === "Full" && (viewer.isMember || viewer.isAdmin);
  }
}

const BY_HREF = new Map(
  (Object.entries(FEATURE_HREF) as [FeatureKey, string][]).map(([k, href]) => [href, k])
);

/** The feature a nav href opens, if any ("/dashboard" and "/welcome" have none). */
export function featureForHref(href: string): FeatureKey | undefined {
  return BY_HREF.get(href);
}
