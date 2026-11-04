import type { DimensionId } from './types';
import type { Messages } from '@/i18n/messages/types';

export interface RouteMeta {
  path: string;
  /** Member-app section name (for display / debugging). */
  section: string;
  /** The destination's name, as the sidebar shows it: nav.<navKey> in the reader's language. */
  navKey: keyof Messages['nav'];
}

/**
 * The member-app routes the report is allowed to deep-link into. The member
 * app's BotPage listener uses this same set as its navigation allowlist.
 */
export const ROUTES: Record<string, RouteMeta> = {
  '/course': { path: '/course', section: 'MM System Course', navKey: 'course' },
  '/strategies': { path: '/strategies', section: 'Strategies', navKey: 'strategies' },
  '/library': { path: '/library', section: 'eBook Library', navKey: 'library' },
  '/live-classes': { path: '/live-classes', section: 'Live Classes', navKey: 'liveClasses' },
  '/daily-analysis': { path: '/daily-analysis', section: 'Daily Analysis', navKey: 'dailyAnalysis' },
  '/calendar': { path: '/calendar', section: 'Economic Calendar', navKey: 'calendar' },
  '/bots/fundamental': { path: '/bots/fundamental', section: 'Fundamental Desk', navKey: 'fundamentalDesk' },
  '/signals': { path: '/signals', section: 'Signals', navKey: 'signals' },
  '/indicators': { path: '/indicators', section: 'Indicators', navKey: 'indicators' },
  '/news': { path: '/news', section: 'News & Articles', navKey: 'news' }
};

/** Allowlisted internal paths — exported for the member-app navigation guard. */
export const ALLOWED_PATHS: string[] = Object.keys(ROUTES);

/** A dimension's "next move": where it goes, and the key of its words (kys.moves.<key>). */
export interface DimensionRoute {
  path: string;
  key: keyof Messages['kys']['moves'];
}

/**
 * For each dimension, the member-app destinations that train it, ordered
 * primary-first. The button selector takes the first option not already used.
 */
export const DIMENSION_ROUTES: Record<DimensionId, DimensionRoute[]> = {
  risk_discipline: [
    { path: '/course', key: 'riskCourse' },
    { path: '/library', key: 'decisionTreesRisk' }
  ],
  emotional_control: [
    { path: '/library', key: 'ifThen' },
    { path: '/live-classes', key: 'liveClass' }
  ],
  independent_conviction: [
    { path: '/course', key: 'startCourse' },
    { path: '/daily-analysis', key: 'todaysRead' }
  ],
  decisiveness: [
    { path: '/strategies', key: 'backtest' },
    { path: '/library', key: 'decisionTreesDecide' }
  ],
  consistency: [
    { path: '/course', key: 'oneSystem' },
    { path: '/strategies', key: 'oneEdge' }
  ],
  process_routine: [
    { path: '/course', key: 'dailySop' },
    { path: '/daily-analysis', key: 'dailyPlan' }
  ]
};
