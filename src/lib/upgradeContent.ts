// Content and logic for the /upgrade redesign (inspired by Higgsfield's pricing
// page: outcome-first cards, visible "from <tier>" gaps, a plan finder and a
// comparison grid). Pure and client-safe, so the cards, slider, finder and grid
// all read one source, and the grid is derived from the real access map, so it
// can't drift from what the gates actually do.
//
// Compliance: every line says what a tier opens, never what it earns. The
// "price" is a deposit into the trader's own account.

import { canAccess, FEATURE_MIN_TIER } from "@/lib/access/features";
import type { FeatureKey } from "@/lib/access/featureKeys";
import { TIER_RANK, TIER_THRESHOLDS, tierLabel, type MemberTier, type PaidTier } from "@/lib/tiers";

export const PAID_TIERS: readonly PaidTier[] = ["foundation", "desk", "team"];

export interface TierContent {
  persona: string;
  /** What this tier adds, in one sentence. */
  adds: string;
  badge?: string;
  note?: string;
}

export const TIER_CONTENT: Readonly<Record<PaidTier, TierContent>> = {
  foundation: {
    persona: "For traders learning the system",
    adds: "The full course, all 19 lessons, and the MM Library.",
  },
  desk: {
    persona: "For traders who want the tools, and to learn it live",
    adds: "10 TradingView indicators, the strategy scripts, live classes with the desk, and the Fundamental Desk's macro read.",
  },
  team: {
    persona: "For traders taking the desk's calls",
    adds: "The private Team MM channel, where the desk's calls go out, and the AI Trading Assistant.",
    badge: "Most complete",
    note: "We don't send calls to an account that can't survive them.",
  },
};

/** The paid features each card lists, in the order a trader climbs them. */
export interface CardRow {
  key: FeatureKey;
  label: string;
  /** Lowest tier that includes it. */
  min: PaidTier;
}

export const CARD_ROWS: readonly CardRow[] = [
  { key: "course", label: "The full course, all 19 lessons", min: "foundation" },
  { key: "library", label: "The MM Library, 4 eBooks", min: "foundation" },
  { key: "indicators", label: "10 TradingView indicators", min: "desk" },
  { key: "strategies", label: "Strategy scripts", min: "desk" },
  { key: "live-classes", label: "Live classes with the desk", min: "desk" },
  { key: "fundamental-desk", label: "The Fundamental Desk", min: "desk" },
  { key: "team-mm", label: "The private Team MM channel: the desk's calls", min: "team" },
  { key: "ai-trading-assistant", label: "The AI Trading Assistant", min: "team" },
];

export function includes(tier: PaidTier, row: CardRow): boolean {
  return TIER_RANK[tier] >= TIER_RANK[row.min];
}

// ─── Comparison grid ─────────────────────────────────────────────────────────

export const GRID_COLUMNS: readonly MemberTier[] = ["free", "foundation", "desk", "team"];

const GRID_LABEL: Readonly<Record<FeatureKey, string>> = {
  "daily-analysis": "Daily Analysis, video and PDF",
  signals: "The public signals channel",
  calendar: "Economic calendar",
  news: "News and sentiment",
  "know-your-style": "Know Your Style",
  course: "The MM Mentorship course",
  library: "The MM Library, 4 eBooks",
  indicators: "10 TradingView indicators",
  strategies: "Strategy scripts",
  "live-classes": "Live classes",
  "fundamental-desk": "The Fundamental Desk",
  "team-mm": "The private Team MM channel",
  "ai-trading-assistant": "The AI Trading Assistant",
};

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

export function buildComparison(): GridRow[] {
  return GRID_ORDER.map((key) => {
    const cells: Record<string, GridCell> = {};
    for (const tier of GRID_COLUMNS) {
      if (key === "course") {
        cells[tier] = tier === "free" ? "Module 1" : "All 19 lessons";
      } else {
        cells[tier] = canAccess(key, { tier, isAdmin: false });
      }
    }
    return { key, label: GRID_LABEL[key], cells };
  });
}

// ─── Plan finder ─────────────────────────────────────────────────────────────

export type Goal = "learn" | "live" | "calls";
export type Budget = "50" | "200" | "500";

export const GOALS: readonly { value: Goal; label: string }[] = [
  { value: "learn", label: "Learn the system, at my own pace" },
  { value: "live", label: "Learn it live, with the desk" },
  { value: "calls", label: "Take the desk's calls" },
];

export const BUDGETS: readonly { value: Budget; label: string }[] = [
  { value: "50", label: "$50 to $199" },
  { value: "200", label: "$200 to $499" },
  { value: "500", label: "$500 or more" },
];

const GOAL_TIER: Readonly<Record<Goal, PaidTier>> = { learn: "foundation", live: "desk", calls: "team" };
const BUDGET_TIER: Readonly<Record<Budget, PaidTier>> = { "50": "foundation", "200": "desk", "500": "team" };

const ARCHETYPE_LINE: Readonly<Record<string, string>> = {
  "The Analysis Paralyser": "You told us you over-think: one tier, one set of tools, fewer decisions.",
  "The Emotional Revenge Trader": "You told us emotion drives your trades: structure you can follow beats more screen time.",
  "The Reckless Gambler": "You told us you size up fast: the course puts risk rules first.",
  "The Signal Dependent": "You told us you lean on signals: pair the calls with the reasoning behind them.",
  "The Indicator Stacker": "You told us you stack indicators: the MM tools replace the clutter with one read.",
  "The System Hopper": "You told us you hop systems: one system, end to end, is the fix.",
  "The Brand New Beginner": "You're new: start with the course, and add more as it clicks.",
  "The News Trader": "You trade the news: the Fundamental Desk reads the macro in plain English.",
};

export interface Recommendation {
  tier: PaidTier;
  why: string;
  archetypeLine: string | null;
  /** Set when the budget starts below the recommended tier. */
  startNote: string | null;
}

export function recommendTier(goal: Goal, budget: Budget | null, archetype: string | null): Recommendation {
  const tier = GOAL_TIER[goal];
  const start = budget ? BUDGET_TIER[budget] : null;
  const startNote =
    start && TIER_RANK[start] < TIER_RANK[tier]
      ? `Start on ${tierLabel(start)} with what you're comfortable with, and top up to ${tierLabel(tier)} ($${TIER_THRESHOLDS[tier]} in total) when you're ready. Every deposit counts towards it.`
      : null;
  return {
    tier,
    why: `${tierLabel(tier)} gives you ${TIER_CONTENT[tier].adds.charAt(0).toLowerCase()}${TIER_CONTENT[tier].adds.slice(1)}`,
    archetypeLine: (archetype && ARCHETYPE_LINE[archetype]) || null,
    startNote,
  };
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

export const FAQ: readonly { q: string; a: string }[] = [
  {
    q: "Is the deposit a fee?",
    a: "No. It goes into your own trading account at the broker, and it stays yours. The broker funds your seat here, so you never pay us a subscription.",
  },
  {
    q: "What if my balance drops?",
    a: "Your tier counts every deposit you've made, never your balance. A losing week never locks you out of the tools.",
  },
  {
    q: "Do I have to deposit it all at once?",
    a: "No. Deposits add up: start at $50, and every top-up moves you towards the next tier.",
  },
  {
    q: "I'm on a trial. If I deposit now, do I lose anything?",
    a: "No. You keep the full desk until your trial ends, then stay on the tier your deposits reach.",
  },
  {
    q: "How does verification work?",
    a: "Submit a screenshot of your deposit on this page. We check it against your trading account and switch your access on.",
  },
  {
    q: "Which broker do I use?",
    a: "Octa, Dupoin or Elev8, depending on where you are. The steps on this page show the right one for your region.",
  },
];

/** Sanity: each card row's tier matches the access map (the course is special). */
export function cardRowsMatchAccessMap(): boolean {
  return CARD_ROWS.every((r) => r.key === "course" || FEATURE_MIN_TIER[r.key] === r.min);
}
