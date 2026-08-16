// Allowlist of button destinations → app paths. The /go redirect ONLY forwards
// to a slug in this map, so a crafted ?url can never turn it into an open
// redirect. Add new CTA targets here.
export const DESTINATIONS: Record<string, string> = {
  signup: "/signup",
  trial: "/signup",
  indicators: "/indicators",
  "daily-analysis": "/daily-analysis",
  signals: "/signals",
  // TeamMM is the private, client-only signals channel. This deep link opens a
  // chat with the admin, who vets and onboards — a raw invite link would dead-end
  // for the non-clients who make up most of the public channel's audience.
  teammm: "https://t.me/m/FtwoPlcaMjFl",
  course: "/course",
  library: "/library",
  strategies: "/strategies",
  "live-classes": "/live-classes",
  calendar: "/calendar",
  news: "/news",
  dashboard: "/dashboard",
  // AI Trading Assistant — the flagship (MMFeatures.md §3)
  journal: "/journal",
  fundamental: "/bots/fundamental",
  "know-your-style": "/bots/know-your-style",
};

const APP_BASE = "https://app.marketmakersfx.net";

// Resolve a slug to its absolute URL, or null if it is not allowlisted.
// Values may be an app path ("/signals") or a full external URL — either way
// only slugs defined above are reachable, so this can't become an open redirect.
export function resolveDestination(slug: string): string | null {
  const target = DESTINATIONS[slug];
  if (!target) return null;
  return /^https?:\/\//.test(target) ? target : `${APP_BASE}${target}`;
}

/** True when the destination is our own app (external links skip UTM tagging). */
export function isAppDestination(slug: string): boolean {
  const target = DESTINATIONS[slug];
  return !!target && !/^https?:\/\//.test(target);
}
