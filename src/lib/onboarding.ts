// The six-step onboarding checklist (conversion-fix Phase 4; the public
// Telegram channel added as step 1 on 22 Oct). Pure and client-safe: the
// /welcome roadmap and the dashboard card both render from it. Progress comes
// from fn_my_onboarding(), which reads each step from where it actually
// happens (a logged channel click, a TradingView username, a Daily Analysis
// view, KYS completion, lesson 1 in the player, a visit to the tier page).

export type OnboardingKey = "telegram" | "tv" | "analysis" | "kys" | "lesson1" | "desk";

/** The public channel. Joining happens on Telegram, so see TELEGRAM_IS_CLAIMED. */
export const PUBLIC_CHANNEL_URL = "https://t.me/mmfx_academy";

/**
 * The one step the app cannot verify: Telegram never tells us whether someone
 * joined, only that they left for it. The UI must not claim more than that —
 * same honest limit as the deposit DM (src/lib/depositRef.ts).
 */
export const TELEGRAM_IS_CLAIMED = true;

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
  /** What the member can do once this step is done. Never a money claim. */
  goal: string;
  /** The concrete target to hit after it — behaviour, never returns. */
  target: string;
  /** True when the href leaves the app. */
  external?: boolean;
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    key: "telegram",
    day: 1,
    title: "Join the public Telegram channel",
    blurb: "Where the desk posts its calls, market notes and session updates as they happen.",
    href: PUBLIC_CHANNEL_URL,
    external: true,
    stage: "The desk",
    goal: "You see what the desk is watching while it still matters, instead of reading about it afterwards.",
    target: "Channel open on your phone before your next session.",
  },
  {
    key: "tv",
    day: 2,
    title: "Connect TradingView",
    blurb: "Save your TradingView username and get the indicators on your chart.",
    href: "/indicators",
    stage: "Execution",
    goal: "The desk's tools draw their levels on your own chart, in your own platform.",
    target: "Set up once — they are there every session after.",
  },
  {
    key: "analysis",
    day: 3,
    title: "Watch today's Daily Analysis",
    blurb: "The desk's read on gold, session by session: bias, levels and the thesis.",
    href: "/daily-analysis",
    stage: "Analysis",
    goal: "You start a session knowing the bias, the levels that matter, and what would prove them wrong.",
    target: "Five sessions watched before you act on one.",
  },
  {
    key: "kys",
    day: 4,
    title: "Take Know Your Style",
    blurb: "A few questions, and you'll know the kind of trader you are.",
    href: "/bots/know-your-style",
    stage: "Trade Management",
    goal: "Your habits in writing — including the weakest one, named.",
    target: "One leak identified, one fix you run for two weeks.",
  },
  {
    key: "lesson1",
    day: 5,
    title: "Finish Module 1, lesson 1",
    blurb: "Golden Mindset: the discipline under every trade in the course.",
    href: "/course",
    stage: "Foundations",
    goal: "The discipline the rest of the system rests on — the part most people skip.",
    target: "Module 1 finished by the end of the week.",
  },
  {
    key: "desk",
    day: 6,
    title: "See what Desk adds",
    blurb: "The TradingView indicators and strategy scripts, live classes, and the Fundamental Desk's macro read.",
    href: "/upgrade",
    stage: "Your next tier",
    goal: "You know exactly what sits behind the next tier before you decide anything.",
    target: "A clear yes or no — not a maybe.",
  },
];

export const EMPTY_ONBOARDING: OnboardingState = {
  telegram: false,
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
  "The Analysis Paralyser": "You over-think the entry. Desk's live classes show how the desk reads a setup and commits to a plan.",
  "The Emotional Revenge Trader": "Desk puts a live class and a rule-based macro read between you and the next revenge trade.",
  "The Reckless Gambler": "Desk's live classes put structure first: where the stop goes, then the size.",
  "The Signal Dependent": "Desk's live classes teach why each trade is taken, so you're not just copying calls.",
  "The Indicator Stacker": "Desk swaps a chart full of indicators for one live read, with the reasoning behind it.",
  "The System Hopper": "Desk is one system, traded live in class: the same rules every day.",
  "The Brand New Beginner": "Desk lets you watch the system traded live in class while you learn it.",
  "The News Trader": "The Fundamental Desk reads the macro behind every move, in plain English.",
};

export function deskPitchFor(archetype: string | null | undefined): string {
  return (archetype && DESK_FOR[archetype]) || ONBOARDING_STEPS[5].blurb;
}
