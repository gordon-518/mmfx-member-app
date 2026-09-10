// The feature access map: one source of truth for what each feature needs.
// Pure and client-safe — the server guard (requireFeature) and the nav's lock
// badges (AppShell) both read it, so the sidebar can never disagree with the
// page.
//
// Each feature names the lowest tier that opens it, straight from the plan's
// tier feature matrix (conversion-fix 3.3; the free/full/member shape of 2.2
// became this ladder without touching the pages again).

import { TIER_RANK, type MemberTier, type PaidTier } from "@/lib/tiers";
import type { FeatureKey } from "./featureKeys";

export type FeatureMinTier = "free" | PaidTier;

export const FEATURE_MIN_TIER: Readonly<Record<FeatureKey, FeatureMinTier>> = {
  calendar: "free",
  news: "free",
  "know-your-style": "free",
  "daily-analysis": "free",
  // Free reaches Module 1 only; the full course is Foundation (course.ts).
  course: "free",
  library: "foundation",
  indicators: "foundation",
  strategies: "foundation",
  signals: "desk",
  "live-classes": "desk",
  "fundamental-desk": "desk",
  "ai-trading-assistant": "team",
  "team-mm": "team",
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
  tier: MemberTier;
  isAdmin: boolean;
}

/**
 * The rank a viewer's access counts at. An admin on any non-free tier reaches
 * everything (support / QA), the rule the member-only pages had before. An
 * admin whose own trial has lapsed is Free like anyone else.
 */
export function viewerRank(viewer: Viewer): number {
  return viewer.isAdmin && viewer.tier !== "free" ? TIER_RANK.team : TIER_RANK[viewer.tier];
}

export function canAccess(key: FeatureKey, viewer: Viewer): boolean {
  return viewerRank(viewer) >= TIER_RANK[FEATURE_MIN_TIER[key]];
}

const BY_HREF = new Map(
  (Object.entries(FEATURE_HREF) as [FeatureKey, string][]).map(([k, href]) => [href, k])
);

/** The feature a nav href opens, if any ("/dashboard" and "/welcome" have none). */
export function featureForHref(href: string): FeatureKey | undefined {
  return BY_HREF.get(href);
}
