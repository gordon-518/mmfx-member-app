import type { MemberTier } from "@/lib/tiers";
import type { EmailHero } from "@/lib/email/shell";

/**
 * The words of one lifecycle email, separated from its structure.
 *
 * This is the contract three things share (v2 plan §0.2): the template holds
 * the approved default in code, `email_variants` stores approved challengers
 * as JSON, and the brain's Opus 5 proposer emits exactly this shape. The
 * limits are not style guidance — the variants route rejects copy that breaks
 * them, and templates.test.ts fails the build on a default that does.
 */
export interface LifecycleCopy {
  /** ≤ 45 chars, one concrete noun, no emoji, no shouting. */
  subject: string;
  /** ≤ 90 chars. The line the inbox shows next to the subject. */
  preheader: string;
  /** 1–3, plain text, no HTML. Digest has none: its body is the card. */
  paragraphs: string[];
  /** ≤ 28 chars, no trailing arrow — the button adds one. */
  ctaLabel: string;
}

export interface LifecycleCtx {
  firstName: string | null;
  audience: "trial" | "expired" | "member";
  tier: MemberTier;
  trialEndsAt: string | null;
  daysSinceSignup: number;
  onboarding: { tv: boolean; analysis: boolean; kys: boolean; lesson1: boolean; desk: boolean };
  todayAnalysis: {
    title: string;
    bias: "bullish" | "bearish" | "neutral";
    description: string | null;
    /**
     * The published cover PNG for today's read (public `analysis-covers`
     * bucket). Optional rather than required so Part C owns filling it from
     * the claim function's new `cover_path` column without Part B having to
     * touch `contextFor` — every template already reads it defensively.
     */
    coverUrl?: string | null;
  } | null;
  appUrl: string;
  unsubUrl: string;
  /**
   * An approved challenger's words, when the claim function put this user in
   * a variant arm. Absent means the template renders its own `defaultCopy`.
   */
  copy?: LifecycleCopy;
}

export interface LifecycleEmail {
  subject: string;
  html: string;
  text: string;
  /** Inbox preview text. The rail hides it in the shell. */
  preheader?: string;
  /** The band under the black header, when this step has one. */
  hero?: EmailHero;
}

export type LifecycleTemplate = (ctx: LifecycleCtx) => LifecycleEmail;
