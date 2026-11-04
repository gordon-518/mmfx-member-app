import { describe, it, expect } from "vitest";
import { MESSAGES } from "@/i18n/messages";
import { en } from "@/i18n/messages/en";
import { LOCALES } from "@/i18n/config";
import { MONEY_CLAIM, leaves } from "@/i18n/moneyClaims";
import {
  ONBOARDING_STEPS,
  PUBLIC_CHANNEL_URL,
  EMPTY_ONBOARDING,
  parseOnboarding,
  onboardingProgress,
  deskPitchFor,
} from "./onboarding";

describe("onboarding checklist", () => {
  it("is six steps, one a day, the channel first (Gordon, 22 Oct)", () => {
    expect(ONBOARDING_STEPS.map((s) => [s.day, s.key])).toEqual([
      [1, "telegram"],
      [2, "tv"],
      [3, "analysis"],
      [4, "kys"],
      [5, "lesson1"],
      [6, "desk"],
    ]);
  });

  it("gives every step a title, blurb, goal and target in every language", () => {
    for (const [locale, t] of Object.entries(MESSAGES)) {
      for (const s of ONBOARDING_STEPS) {
        const copy = t.onboarding.steps[s.key];
        expect(copy.title.length, `${locale}/${s.key}`).toBeGreaterThan(2);
        expect(copy.goal.length, `${locale}/${s.key}`).toBeGreaterThan(8);
        expect(copy.target.length, `${locale}/${s.key}`).toBeGreaterThan(5);
      }
    }
  });

  it("makes no earnings claims in any language", () => {
    for (const locale of LOCALES) {
      const offending = leaves(MESSAGES[locale].onboarding).filter(([, text]) => MONEY_CLAIM[locale].test(text));
      expect(offending, locale).toEqual([]);
    }
  });

  it("sends the channel step off-app and keeps the rest in it", () => {
    const tg = ONBOARDING_STEPS[0];
    expect(tg.external).toBe(true);
    expect(tg.href).toBe(PUBLIC_CHANNEL_URL);
    expect(PUBLIC_CHANNEL_URL).toBe("https://t.me/mmfx_academy");
    for (const s of ONBOARDING_STEPS.slice(1)) {
      expect(s.external, s.key).toBeUndefined();
      expect(s.href.startsWith("/"), s.key).toBe(true);
    }
  });

  it("starts at step 1 with nothing done", () => {
    const p = onboardingProgress(EMPTY_ONBOARDING);
    expect(p.doneCount).toBe(0);
    expect(p.pct).toBe(0);
    expect(p.next?.key).toBe("telegram");
    expect(p.complete).toBe(false);
  });

  it("points at the first open step, even when a later one is done", () => {
    const p = onboardingProgress({ ...EMPTY_ONBOARDING, telegram: true, kys: true });
    expect(p.doneCount).toBe(2);
    expect(p.pct).toBe(33);
    expect(p.next?.key).toBe("tv");
  });

  it("is complete when all six are done", () => {
    const p = onboardingProgress({ telegram: true, tv: true, analysis: true, kys: true, lesson1: true, desk: true });
    expect(p.complete).toBe(true);
    expect(p.next).toBeNull();
    expect(p.pct).toBe(100);
  });
});

describe("parseOnboarding", () => {
  it("reads the RPC's booleans", () => {
    expect(parseOnboarding({ telegram: true, tv: true, analysis: false, kys: true, lesson1: false, desk: true })).toEqual({
      telegram: true, tv: true, analysis: false, kys: true, lesson1: false, desk: true,
    });
  });
  it("treats anything missing or non-boolean as not done", () => {
    expect(parseOnboarding(null)).toEqual(EMPTY_ONBOARDING);
    expect(parseOnboarding({ tv: "yes", kys: 1 })).toEqual(EMPTY_ONBOARDING);
  });
});

describe("deskPitchFor", () => {
  it("tailors the tier step by archetype ID — what profiles actually store", () => {
    expect(deskPitchFor(en, "analysis_paralyser")).toMatch(/over-think/);
    expect(deskPitchFor(en, "news_trader")).toMatch(/Fundamental Desk/);
  });
  it("is in the reader's language, with the Fundamental Desk named as it is everywhere", () => {
    expect(deskPitchFor(MESSAGES["zh-Hans"], "news_trader")).toMatch(/^Fundamental Desk 会解读/);
    expect(deskPitchFor(MESSAGES.ms, "news_trader")).toMatch(/^Fundamental Desk membaca faktor makro/);
  });
  it("no longer matches on a display name, and falls back to the general line", () => {
    expect(deskPitchFor(en, "The News Trader")).toBe(en.onboarding.steps.desk.blurb);
    expect(deskPitchFor(en, null)).toBe(en.onboarding.steps.desk.blurb);
    expect(deskPitchFor(en, "not_an_archetype")).toBe(en.onboarding.steps.desk.blurb);
  });
  it("covers every archetype in every language", () => {
    const ids = ["reckless_gambler", "analysis_paralyser", "signal_dependent", "indicator_stacker",
      "emotional_revenge_trader", "news_trader", "system_hopper", "brand_new_beginner"];
    for (const t of Object.values(MESSAGES)) {
      for (const id of ids) expect(deskPitchFor(t, id)).not.toBe(t.onboarding.steps.desk.blurb);
    }
  });
});
