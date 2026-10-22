import { describe, it, expect } from "vitest";
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

  it("gives every step a goal and a target to hit after it", () => {
    for (const s of ONBOARDING_STEPS) {
      expect(s.goal.length, s.key).toBeGreaterThan(20);
      expect(s.target.length, s.key).toBeGreaterThan(10);
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
  it("tailors the tier step to the KYS archetype", () => {
    expect(deskPitchFor("The Analysis Paralyser")).toMatch(/over-think/);
  });
  it("falls back to the general line", () => {
    expect(deskPitchFor(null)).toBe(ONBOARDING_STEPS[5].blurb);
    expect(deskPitchFor("The Unknown Type")).toBe(ONBOARDING_STEPS[5].blurb);
  });
  it("keeps every step's own copy free of money claims", () => {
    for (const s of ONBOARDING_STEPS) {
      for (const text of [s.title, s.blurb, s.goal, s.target]) {
        expect(text, s.key).not.toMatch(/\b(profits?|profitable|profitably|returns?|earns?|earnings|guaranteed?|income|rich)\b/i);
      }
    }
  });

  it("never promises returns", () => {
    for (const a of ["The Analysis Paralyser", "The Emotional Revenge Trader", "The Reckless Gambler",
      "The Signal Dependent", "The Indicator Stacker", "The System Hopper", "The Brand New Beginner", "The News Trader"]) {
      // Whole words: "learn" contains "earn" and is fine.
      expect(deskPitchFor(a)).not.toMatch(/\b(profits?|profitable|returns?|earns?|earnings|guaranteed?|income)\b/i);
    }
  });
});
