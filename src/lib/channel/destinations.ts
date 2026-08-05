// Allowlist of button destinations → app paths. The /go redirect ONLY forwards
// to a slug in this map, so a crafted ?url can never turn it into an open
// redirect. Add new CTA targets here.
export const DESTINATIONS: Record<string, string> = {
  signup: "/signup",
  trial: "/signup",
  indicators: "/indicators",
  "daily-analysis": "/daily-analysis",
  signals: "/signals",
  course: "/course",
  library: "/library",
  strategies: "/strategies",
  "live-classes": "/live-classes",
  fundamental: "/bots/fundamental",
  "know-your-style": "/bots/know-your-style",
};

const APP_BASE = "https://app.marketmakersfx.net";

// Resolve a slug to its absolute app URL, or null if it is not allowlisted.
export function resolveDestination(slug: string): string | null {
  const path = DESTINATIONS[slug];
  return path ? `${APP_BASE}${path}` : null;
}
