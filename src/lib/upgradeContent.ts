// Content and logic for the /upgrade redesign (inspired by Higgsfield's pricing
// page: outcome-first cards, visible "from <tier>" gaps, a plan finder and a
// comparison grid). Pure and client-safe, so the cards, slider, finder and grid
// all read one source, and the grid is derived from the real access map, so it
// can't drift from what the gates actually do.
//
// The words live in the i18n dictionary (messages/<locale>/plans.ts); this
// module holds the structure. Every function takes the reader's dictionary and
// defaults to English, so tests and server code can call it without a locale.
//
// Compliance: every line says what a tier opens, never what it earns. The
// "price" is a deposit into the trader's own account.

import { canAccess, FEATURE_MIN_TIER } from "@/lib/access/features";
import type { FeatureKey } from "@/lib/access/featureKeys";
import { CONTENT_VARS, LESSON_COUNT } from "@/lib/contentCounts";
import { TIER_RANK, TIER_THRESHOLDS, type MemberTier, type PaidTier } from "@/lib/tiers";
import { fmt } from "@/i18n/format";
import { en } from "@/i18n/messages/en";
import type { Messages } from "@/i18n/messages/types";

type Plans = Messages["plans"];
type TierNames = Messages["tiers"];

export const PAID_TIERS: readonly PaidTier[] = ["foundation", "desk", "team"];

export interface TierContent {
  persona: string;
  /** What this tier adds, in one sentence. */
  adds: string;
  badge?: string;
  note?: string;
}

export function tierContent(tier: PaidTier, p: Plans = en.plans): TierContent {
  const c = p.tiers[tier];
  const base = { persona: c.persona, adds: fmt(c.adds, CONTENT_VARS) };
  return tier === "team" ? { ...base, badge: p.badgeTeam, note: p.noteTeam } : base;
}

/** The paid features each card lists, in the order a trader climbs them. */
export type CardRowKey = keyof Plans["rows"] & FeatureKey;

export interface CardRow {
  key: CardRowKey;
  /** Lowest tier that includes it. */
  min: PaidTier;
}

export const CARD_ROWS: readonly CardRow[] = [
  { key: "course", min: "foundation" },
  { key: "library", min: "foundation" },
  { key: "indicators", min: "desk" },
  { key: "strategies", min: "desk" },
  { key: "live-classes", min: "desk" },
  { key: "fundamental-desk", min: "desk" },
  { key: "team-mm", min: "team" },
  { key: "ai-trading-assistant", min: "team" },
];

export function rowLabel(key: CardRowKey, p: Plans = en.plans): string {
  return fmt(p.rows[key], CONTENT_VARS);
}

export function includes(tier: PaidTier, row: CardRow): boolean {
  return TIER_RANK[tier] >= TIER_RANK[row.min];
}

// ─── Comparison grid ─────────────────────────────────────────────────────────

export const GRID_COLUMNS: readonly MemberTier[] = ["free", "foundation", "desk", "team"];

const GRID_ORDER: readonly FeatureKey[] = [
  "daily-analysis", "signals", "calendar", "news", "know-your-style",
  "course", "library", "indicators", "strategies",
  "live-classes", "fundamental-desk",
  "team-mm", "ai-trading-assistant",
];

/** true / false, or a short note where a tier gets part of a feature. */
export type GridCell = boolean | string;

export interface GridRow {
  key: FeatureKey;
  label: string;
  cells: Record<string, GridCell>;
}

export function buildComparison(p: Plans = en.plans): GridRow[] {
  return GRID_ORDER.map((key) => {
    const cells: Record<string, GridCell> = {};
    for (const tier of GRID_COLUMNS) {
      if (key === "course") {
        cells[tier] = tier === "free" ? p.module1 : fmt(p.allLessons, { n: LESSON_COUNT });
      } else {
        cells[tier] = canAccess(key, { tier, isAdmin: false });
      }
    }
    return { key, label: fmt(p.grid[key], CONTENT_VARS), cells };
  });
}

// ─── Plan finder ─────────────────────────────────────────────────────────────

export type Goal = keyof Plans["goals"];
export type Budget = "50" | "200" | "500";

export const GOALS: readonly Goal[] = ["learn", "live", "calls"];
export const BUDGETS: readonly Budget[] = ["50", "200", "500"];

export function budgetLabel(budget: Budget, p: Plans = en.plans): string {
  return p.budgets[`b${budget}`];
}

const GOAL_TIER: Readonly<Record<Goal, PaidTier>> = { learn: "foundation", live: "desk", calls: "team" };
const BUDGET_TIER: Readonly<Record<Budget, PaidTier>> = { "50": "foundation", "200": "desk", "500": "team" };

export interface Recommendation {
  tier: PaidTier;
  why: string;
  archetypeLine: string | null;
  /** Set when the budget starts below the recommended tier. */
  startNote: string | null;
}

/**
 * archetypeId is profiles.kys_archetype, which stores the archetype's ID
 * ("news_trader"), not its display name.
 */
export function recommendTier(
  goal: Goal,
  budget: Budget | null,
  archetypeId: string | null,
  p: Plans = en.plans,
  names: TierNames = en.tiers
): Recommendation {
  const tier = GOAL_TIER[goal];
  const start = budget ? BUDGET_TIER[budget] : null;
  const startNote =
    start && TIER_RANK[start] < TIER_RANK[tier]
      ? fmt(p.startNote, { start: names[start], tier: names[tier], amount: `$${TIER_THRESHOLDS[tier]}` })
      : null;
  const lines = p.archetype as Record<string, string | undefined>;
  return {
    tier,
    why: fmt(p.tiers[tier].why, CONTENT_VARS),
    archetypeLine: (archetypeId && lines[archetypeId]) || null,
    startNote,
  };
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [1, 2, 3, 4, 5, 6] as const;

export function faq(p: Plans = en.plans): { q: string; a: string }[] {
  return FAQ_ITEMS.map((n) => ({ q: p.faq[`q${n}`], a: p.faq[`a${n}`] }));
}

/** Sanity: each card row's tier matches the access map (the course is special). */
export function cardRowsMatchAccessMap(): boolean {
  return CARD_ROWS.every((r) => r.key === "course" || FEATURE_MIN_TIER[r.key] === r.min);
}
