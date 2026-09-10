// The five-step onboarding checklist (conversion-fix Phase 4). Pure and
// client-safe: the /welcome checklist and the dashboard card both render from
// it. Progress itself comes from fn_my_onboarding(), which reads each step from
// where it actually happens (TradingView username, a Daily Analysis view, KYS
// completion, lesson 1 in the player, a visit to the tier page).

export type OnboardingKey = "tv" | "analysis" | "kys" | "lesson1" | "desk";

export type OnboardingState = Record<OnboardingKey, boolean>;

export interface OnboardingStep {
  key: OnboardingKey;
  /** Suggested pace: one step a day. */
  day: number;
  title: string;
  blurb: string;
  href: string;
  /** The roadmap stage it belongs to (the same spine as the dashboard rails). */
  stage: string;
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    key: "tv",
    day: 1,
    title: "Connect TradingView",
    blurb: "Save your TradingView username and get the indicators on your chart.",
    href: "/indicators",
    stage: "Execution",
  },
  {
    key: "analysis",
    day: 2,
    title: "Watch today's Daily Analysis",
    blurb: "The desk's read on gold, session by session: bias, levels and the thesis.",
    href: "/daily-analysis",
    stage: "Analysis",
  },
  {
    key: "kys",
    day: 3,
    title: "Take Know Your Style",
    blurb: "A few questions, and you'll know the kind of trader you are.",
    href: "/bots/know-your-style",
    stage: "Trade Management",
  },
  {
    key: "lesson1",
    day: 4,
    title: "Finish Module 1, lesson 1",
    blurb: "Golden Mindset: the discipline under every trade in the course.",
    href: "/course",
    stage: "Foundations",
  },
  {
    key: "desk",
    day: 5,
    title: "See what Desk adds",
    blurb: "Signals, live classes and the Fundamental Desk: the tier that takes the calls.",
    href: "/upgrade",
    stage: "Your next tier",
  },
];

export const EMPTY_ONBOARDING: OnboardingState = {
  tv: false,
  analysis: false,
  kys: false,
  lesson1: false,
  desk: false,
};

/** Read fn_my_onboarding()'s JSON defensively: anything missing counts as not done. */
export function parseOnboarding(raw: unknown): OnboardingState {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = { ...EMPTY_ONBOARDING };
  for (const k of Object.keys(out) as OnboardingKey[]) out[k] = r[k] === true;
  return out;
}

export interface OnboardingProgress {
  steps: (OnboardingStep & { done: boolean })[];
  doneCount: number;
  total: number;
  /** 0–100, rounded. */
  pct: number;
  /** The first step not yet done, in order; null when complete. */
  next: OnboardingStep | null;
  complete: boolean;
}

export function onboardingProgress(state: OnboardingState): OnboardingProgress {
  const steps = ONBOARDING_STEPS.map((s) => ({ ...s, done: state[s.key] === true }));
  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const next = steps.find((s) => !s.done) ?? null;
  return {
    steps,
    doneCount,
    total,
    pct: Math.round((doneCount / total) * 100),
    next,
    complete: doneCount === total,
  };
}

/**
 * Step 5, tailored to the KYS archetype (plan 4.1: "the tier prompt, tailored
 * to the KYS archetype"). Says what Desk gives that archetype; never what it
 * earns. Unknown or missing archetypes get the general line.
 */
const DESK_FOR: Readonly<Record<string, string>> = {
  "The Analysis Paralyser": "You over-think the entry. Desk's signals hand you the call and the levels, so you can act on a plan.",
  "The Emotional Revenge Trader": "Desk puts a rule-based call and a live class between you and the next revenge trade.",
  "The Reckless Gambler": "Desk's calls come with a stop on every one. Structure first, size second.",
  "The Signal Dependent": "Desk gives you the calls, and live classes to learn why each one was taken.",
  "The Indicator Stacker": "Desk swaps a chart full of indicators for one read and one call, with the reasoning.",
  "The System Hopper": "Desk is one system, traded live: the same rules every day.",
  "The Brand New Beginner": "Desk lets you watch the calls and the live classes while you learn the system.",
  "The News Trader": "The Fundamental Desk reads the macro for you, and Desk's calls are timed around it.",
};

export function deskPitchFor(archetype: string | null | undefined): string {
  return (archetype && DESK_FOR[archetype]) || ONBOARDING_STEPS[4].blurb;
}
