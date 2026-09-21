import type { MemberTier } from "@/lib/tiers";

export interface LifecycleCtx {
  firstName: string | null;
  audience: "trial" | "expired" | "member";
  tier: MemberTier;
  trialEndsAt: string | null;
  daysSinceSignup: number;
  onboarding: { tv: boolean; analysis: boolean; kys: boolean; lesson1: boolean; desk: boolean };
  todayAnalysis: { title: string; bias: "bullish" | "bearish" | "neutral"; description: string | null } | null;
  appUrl: string;
  unsubUrl: string;
}
export interface LifecycleEmail { subject: string; html: string; text: string; }
export type LifecycleTemplate = (ctx: LifecycleCtx) => LifecycleEmail;
