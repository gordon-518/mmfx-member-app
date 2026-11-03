// The six-step onboarding checklist (conversion-fix Phase 4; the public
// Telegram channel added as step 1 on 22 Oct). Pure and client-safe: the
// /welcome roadmap and the dashboard card both render from it. Progress comes
// from fn_my_onboarding(), which reads each step from where it actually
// happens (a logged channel click, a TradingView username, a Daily Analysis
// view, KYS completion, lesson 1 in the player, a visit to the tier page).

import type { Messages } from "@/i18n/messages/types";

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

/** Which part of the climb a step belongs to. Display text: t.onboarding.stages. */
export type StageKey = "theDesk" | "execution" | "analysis" | "tradeManagement" | "foundations" | "nextTier";

export interface OnboardingStep {
  key: OnboardingKey;
  /** Suggested pace: one step a day. */
  day: number;
  href: string;
  /** The roadmap stage it belongs to (the same spine as the dashboard rails). */
  stageKey: StageKey;
  /** True when the href leaves the app. */
  external?: boolean;
}

// Structure only. Every word a member reads — title, blurb, the goal it gets
// them and the target to hit after it — lives in the dictionaries under
// onboarding.steps.<key>, in all five languages (src/i18n/messages).
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  { key: "telegram", day: 1, href: PUBLIC_CHANNEL_URL, external: true, stageKey: "theDesk" },
  { key: "tv", day: 2, href: "/indicators", stageKey: "execution" },
  { key: "analysis", day: 3, href: "/daily-analysis", stageKey: "analysis" },
  { key: "kys", day: 4, href: "/bots/know-your-style", stageKey: "tradeManagement" },
  { key: "lesson1", day: 5, href: "/course", stageKey: "foundations" },
  { key: "desk", day: 6, href: "/upgrade", stageKey: "nextTier" },
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
 * The tier step, tailored to the member's Know Your Style archetype. Says what
 * Desk gives that archetype; never what it earns.
 *
 * Keyed by archetype ID — the value profiles.kys_archetype actually stores
 * ("news_trader"). It used to be keyed by display name ("The News Trader"),
 * so the lookup never matched and every member got the general line.
 */
export function deskPitchFor(t: Messages, archetypeId: string | null | undefined): string {
  const tailored = (t.onboarding.deskFor as Record<string, string | undefined>)[archetypeId ?? ""];
  return tailored ?? t.onboarding.steps.desk.blurb;
}
