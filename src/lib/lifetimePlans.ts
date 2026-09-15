// The US/UK lifetime plans (conversion-fix Phase 6). Pure and client-safe:
// /upgrade, the admin grant form and the access rules all read this.
// The partnered brokers can't take US/UK clients, so these traders pay once
// instead of depositing through our IB. Copy says what each plan opens, never
// what it earns.

export type LifetimePlan = "team" | "team_mentorship";

export interface LifetimePlanInfo {
  name: string;
  priceUsd: number;
  pitch: string;
  includes: string[];
}

export const LIFETIME_PLANS: Readonly<Record<LifetimePlan, LifetimePlanInfo>> = {
  team: {
    name: "Team MM Access",
    priceUsd: 588,
    pitch: "The whole desk, for life",
    includes: [
      "Signals, and the private Team MM channel",
      "Live classes and the Fundamental Desk",
      "10 TradingView indicators and the strategy scripts",
      "The MM Library, 4 eBooks",
      "The AI Trading Assistant (needs your trading account number)",
      "Module 1 of the course",
    ],
  },
  team_mentorship: {
    name: "Team MM + Mentorship",
    priceUsd: 1588,
    pitch: "The whole desk and the full Mentorship, for life",
    includes: [
      "Everything in Team MM Access",
      "The full MM Mentorship: all 19 lessons, basic to advanced",
      "Every lesson's slide deck to download",
    ],
  },
};

export const LIFETIME_PLAN_ORDER: readonly LifetimePlan[] = ["team", "team_mentorship"];

export function isLifetimePlan(v: unknown): v is LifetimePlan {
  return v === "team" || v === "team_mentorship";
}

/** "USD 588", "USD 1,588". */
export function lifetimePrice(plan: LifetimePlan): string {
  return `USD ${LIFETIME_PLANS[plan].priceUsd.toLocaleString("en-US")}`;
}

// The US/UK contact channels. The WhatsApp message names the plan and price,
// so the conversation starts with what the trader chose.
const WHATSAPP_NUMBER = "6588035858";
export const CONTACT_TELEGRAM_URL = "https://t.me/m/GIf6KqN9ZWZl";

export function lifetimeWhatsAppUrl(plan: LifetimePlan, current: LifetimePlan | null = null): string {
  const text =
    current === "team" && plan === "team_mentorship"
      ? "Hi MMFX, I have Team MM Access and I'd like to add the Mentorship."
      : `Hi MMFX, I'm in the US/UK and I'd like the ${LIFETIME_PLANS[plan].name} lifetime plan (${lifetimePrice(plan)}).`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
