import { describe, it, expect } from "vitest";
import { TOUR_STEPS } from "./steps";
import { LOCALES } from "@/i18n/config";
import { MESSAGES } from "@/i18n/messages";
import { MONEY_CLAIM } from "@/i18n/moneyClaims";

// The tour points at real elements. These keep the script honest: every stop
// that claims a target names one the shell actually renders, and the copy
// stays inside the house rules.
const SHELL_TARGETS = [
  "nav",
  "nav-home",
  "nav-read",
  "nav-execute",
  "nav-manage",
  "nav-foundations",
  "nav-account",
  "welcome-steps",
];

describe("guided tour", () => {
  it("opens and closes with a card that isn't pointing at anything", () => {
    expect(TOUR_STEPS[0].target).toBeUndefined();
    expect(TOUR_STEPS[TOUR_STEPS.length - 1].target).toBeUndefined();
  });

  it("only points at targets the app renders", () => {
    for (const s of TOUR_STEPS) {
      if (s.target) expect(SHELL_TARGETS, s.key).toContain(s.target);
    }
  });

  it("marks every sidebar stop so the mobile drawer gets opened", () => {
    for (const s of TOUR_STEPS) {
      if (s.target?.startsWith("nav")) expect(s.inNav, s.key).toBe(true);
      if (s.target === "welcome-steps") expect(s.inNav, s.key).toBeUndefined();
    }
  });

  it("has unique keys and copy worth reading", () => {
    expect(new Set(TOUR_STEPS.map((s) => s.key)).size).toBe(TOUR_STEPS.length);
    for (const s of TOUR_STEPS) {
      const { title, body } = MESSAGES.en.tour.steps[s.key];
      expect(title.length, s.key).toBeGreaterThan(4);
      expect(body.length, s.key).toBeGreaterThan(60);
    }
  });

  it("has every stop in every language, with no earnings claims", () => {
    for (const locale of LOCALES) {
      for (const s of TOUR_STEPS) {
        const { title, body } = MESSAGES[locale].tour.steps[s.key];
        expect(title.length, `${locale}/${s.key}`).toBeGreaterThan(0);
        expect(body.length, `${locale}/${s.key}`).toBeGreaterThan(20);
        expect(`${title} ${body}`, `${locale}/${s.key}`).not.toMatch(MONEY_CLAIM[locale]);
      }
    }
  });
});
