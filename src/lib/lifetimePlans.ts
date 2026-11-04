// The US/UK lifetime plans (conversion-fix Phase 6). Pure and client-safe:
// /upgrade, the admin grant form and the access rules all read this.
// The partnered brokers can't take US/UK clients, so these traders pay once
// instead of depositing through our IB. Copy says what each plan opens, never
// what it earns.
//
// The plan names are brand names and stay English everywhere; the pitch and
// the "includes" lines live in the i18n dictionary (upgrade.lifetime), and
// LIFETIME_PLANS carries the English for the admin pages and the support facts.

import { CONTENT_VARS } from "@/lib/contentCounts";
import { fmt } from "@/i18n/format";
import { en } from "@/i18n/messages/en";
import type { Messages } from "@/i18n/messages/types";

export type LifetimePlan = "team" | "team_mentorship";

export interface LifetimePlanInfo {
  name: string;
  priceUsd: number;
  pitch: string;
  includes: string[];
}

const PLAN_NAME: Readonly<Record<LifetimePlan, string>> = {
  team: "Team MM Access",
  team_mentorship: "Team MM + Mentorship",
};

const PRICE_USD: Readonly<Record<LifetimePlan, number>> = { team: 588, team_mentorship: 1588 };

/** A plan's pitch and "includes" lines in the reader's language. */
export function lifetimeCopy(
  plan: LifetimePlan,
  l: Messages["upgrade"]["lifetime"] = en.upgrade.lifetime
): Pick<LifetimePlanInfo, "pitch" | "includes"> {
  const c = l[plan];
  const vars = { ...CONTENT_VARS, plan: PLAN_NAME.team };
  return { pitch: c.pitch, includes: Object.values(c.includes).map((line) => fmt(line, vars)) };
}

function planInfo(plan: LifetimePlan): LifetimePlanInfo {
  return { name: PLAN_NAME[plan], priceUsd: PRICE_USD[plan], ...lifetimeCopy(plan) };
}

export const LIFETIME_PLANS: Readonly<Record<LifetimePlan, LifetimePlanInfo>> = {
  team: planInfo("team"),
  team_mentorship: planInfo("team_mentorship"),
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
