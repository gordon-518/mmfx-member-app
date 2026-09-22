import type { MemberTier } from "@/lib/tiers";

export interface LifecycleCopy {
  subject: string;          // ≤ 45 chars
  preheader: string;        // ≤ 90 chars
  paragraphs: string[];     // 1–3, plain text, no HTML
  ctaLabel: string;         // ≤ 28 chars, no trailing arrow (ui adds it)
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
    /** Public analysis-covers URL for the read's cover image, when it has one. */
    coverUrl?: string | null;
  } | null;
  appUrl: string;
  unsubUrl: string;
  /** An approved challenger arm's copy; absent means the template's default. */
  copy?: LifecycleCopy;
}
export interface LifecycleEmail { subject: string; html: string; text: string; }
export type LifecycleTemplate = (ctx: LifecycleCtx) => LifecycleEmail;
