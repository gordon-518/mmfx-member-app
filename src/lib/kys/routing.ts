import type { DimensionId, Keystone } from './types';

export interface RouteMeta {
  path: string;
  label: string;
  /** Member-app section name (for display / debugging). */
  section: string;
}

/**
 * The member-app routes the report is allowed to deep-link into. The member
 * app's BotPage listener uses this same set as its navigation allowlist.
 */
export const ROUTES: Record<string, RouteMeta> = {
  '/course': { path: '/course', label: 'Course', section: 'MM System Course' },
  '/strategies': { path: '/strategies', label: 'Strategies', section: 'Strategies' },
  '/library': { path: '/library', label: 'Library', section: 'eBook Library' },
  '/live-classes': { path: '/live-classes', label: 'Live Classes', section: 'Live Classes' },
  '/daily-analysis': { path: '/daily-analysis', label: 'Daily Analysis', section: 'Daily Analysis' },
  '/calendar': { path: '/calendar', label: 'Calendar', section: 'Economic Calendar' },
  '/bots/fundamental': { path: '/bots/fundamental', label: 'Fundamental Desk', section: 'Fundamental Desk' },
  '/signals': { path: '/signals', label: 'Signals', section: 'Signals' },
  '/indicators': { path: '/indicators', label: 'Indicators', section: 'Indicators' },
  '/news': { path: '/news', label: 'News', section: 'News & Articles' }
};

/** Allowlisted internal paths — exported for the member-app navigation guard. */
export const ALLOWED_PATHS: string[] = Object.keys(ROUTES);

/**
 * For each dimension, the member-app destinations that train it, ordered
 * primary-first. The button selector takes the first option not already used.
 */
export const DIMENSION_ROUTES: Record<DimensionId, Keystone[]> = {
  risk_discipline: [
    { path: '/course', label: 'Managing & Routine module', why: 'Daily loss limits and fixed sizing — the risk rules, encoded.' },
    { path: '/library', label: 'Decision Trees & Invalidation', why: 'Know exactly when you are wrong, before you enter.' }
  ],
  emotional_control: [
    { path: '/library', label: 'Read the If-Then eBook', why: 'Pre-commit your reactions so a loss cannot hijack you.' },
    { path: '/live-classes', label: 'Join a Live Class', why: 'Watch the desk manage a position calmly, in real time.' }
  ],
  independent_conviction: [
    { path: '/course', label: 'Start the MM System Course', why: 'Learn to read structure yourself instead of leaning on signals.' },
    { path: '/daily-analysis', label: "Today's gold read", why: 'See a full read built and reasoned, session by session.' }
  ],
  decisiveness: [
    { path: '/strategies', label: 'Backtest a strategy', why: 'Build trust in your rules so you can pull the trigger.' },
    { path: '/library', label: 'Decision Trees & Invalidation', why: 'A defined checklist kills hesitation at the chart.' }
  ],
  consistency: [
    { path: '/course', label: 'Commit to one system', why: 'One framework, learned end to end, traded long enough to prove out.' },
    { path: '/strategies', label: 'One backtested edge', why: 'Pick a single strategy and give it a real sample.' }
  ],
  process_routine: [
    { path: '/course', label: 'The Daily SOP', why: 'A repeatable routine: mark, bias, wait, confirm, manage, journal.' },
    { path: '/daily-analysis', label: 'Start with the daily plan', why: 'Begin every session knowing what the desk expects and why.' }
  ]
};
