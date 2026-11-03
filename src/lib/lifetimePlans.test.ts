import { describe, it, expect } from "vitest";
import {
  LIFETIME_PLANS,
  LIFETIME_PLAN_ORDER,
  isLifetimePlan,
  lifetimeCopy,
  lifetimePrice,
  lifetimeWhatsAppUrl,
} from "./lifetimePlans";
import { LOCALES } from "@/i18n/config";
import { MESSAGES } from "@/i18n/messages";
import { MONEY_CLAIM, leaves } from "@/i18n/moneyClaims";

describe("lifetime plans", () => {
  it("has the two US/UK plans at the agreed prices", () => {
    expect(LIFETIME_PLAN_ORDER).toEqual(["team", "team_mentorship"]);
    expect(LIFETIME_PLANS.team.priceUsd).toBe(588);
    expect(LIFETIME_PLANS.team_mentorship.priceUsd).toBe(1588);
    expect(lifetimePrice("team")).toBe("USD 588");
    expect(lifetimePrice("team_mentorship")).toBe("USD 1,588");
  });

  it("recognises only real plan keys", () => {
    expect(isLifetimePlan("team")).toBe(true);
    expect(isLifetimePlan("team_mentorship")).toBe(true);
    expect(isLifetimePlan("gold")).toBe(false);
    expect(isLifetimePlan(null)).toBe(false);
  });

  it("names the plan and price in the WhatsApp message", () => {
    const url = decodeURIComponent(lifetimeWhatsAppUrl("team_mentorship"));
    expect(url).toContain("Team MM + Mentorship lifetime plan (USD 1,588)");
  });

  it("asks to add Mentorship when the member already has Team MM", () => {
    expect(decodeURIComponent(lifetimeWhatsAppUrl("team_mentorship", "team"))).toContain("add the Mentorship");
  });

  it("makes no earnings claims", () => {
    const copy = JSON.stringify(LIFETIME_PLANS);
    expect(copy).not.toMatch(/\b(profits?|profitable|returns?|earns?|earnings|income|guaranteed?)\b/i);
  });

  it("fills the real counts into the English lines", () => {
    expect(LIFETIME_PLANS.team.includes).toContain("10 TradingView indicators and the strategy scripts");
    expect(LIFETIME_PLANS.team.includes).toContain("The MM Library, 4 eBooks");
    expect(LIFETIME_PLANS.team_mentorship.includes[0]).toBe("Everything in Team MM Access");
    expect(LIFETIME_PLANS.team_mentorship.includes[1]).toMatch(/all 19 lessons/);
  });

  it("has every line in every language, with the brand plan name kept", () => {
    for (const locale of LOCALES) {
      const team = lifetimeCopy("team", MESSAGES[locale].upgrade.lifetime);
      const mentorship = lifetimeCopy("team_mentorship", MESSAGES[locale].upgrade.lifetime);
      expect(team.includes, locale).toHaveLength(LIFETIME_PLANS.team.includes.length);
      expect(mentorship.includes, locale).toHaveLength(LIFETIME_PLANS.team_mentorship.includes.length);
      expect(mentorship.includes[0], locale).toContain("Team MM Access");
    }
  });

  it("makes no earnings claims in any language", () => {
    for (const locale of LOCALES) {
      const offending = leaves(MESSAGES[locale].upgrade).filter(([, s]) => MONEY_CLAIM[locale].test(s));
      expect(offending, locale).toEqual([]);
    }
  });
});
