import { describe, it, expect } from "vitest";
import {
  LIFETIME_PLANS,
  LIFETIME_PLAN_ORDER,
  isLifetimePlan,
  lifetimePrice,
  lifetimeWhatsAppUrl,
} from "./lifetimePlans";

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
});
