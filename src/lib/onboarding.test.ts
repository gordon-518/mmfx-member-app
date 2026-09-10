import { describe, it, expect } from "vitest";
import {
  ONBOARDING_STEPS,
  EMPTY_ONBOARDING,
  parseOnboarding,
  onboardingProgress,
  deskPitchFor,
} from "./onboarding";

describe("onboarding checklist", () => {
  it("is the plan's five steps, one a day, in order", () => {
    expect(ONBOARDING_STEPS.map((s) => [s.day, s.key])).toEqual([
      [1, "tv"],
      [2, "analysis"],
      [3, "kys"],
      [4, "lesson1"],
      [5, "desk"],
    ]);
  });

  it("starts at step 1 with nothing done", () => {
    const p = onboardingProgress(EMPTY_ONBOARDING);
    expect(p.doneCount).toBe(0);
    expect(p.pct).toBe(0);
    expect(p.next?.key).toBe("tv");
    expect(p.complete).toBe(false);
  });

  it("points at the first open step, even when a later one is done", () => {
    const p = onboardingProgress({ ...EMPTY_ONBOARDING, tv: true, kys: true });
    expect(p.doneCount).toBe(2);
    expect(p.pct).toBe(40);
    expect(p.next?.key).toBe("analysis");
  });

  it("is complete when all five are done", () => {
    const p = onboardingProgress({ tv: true, analysis: true, kys: true, lesson1: true, desk: true });
    expect(p.complete).toBe(true);
    expect(p.next).toBeNull();
    expect(p.pct).toBe(100);
  });
});

describe("parseOnboarding", () => {
  it("reads the RPC's booleans", () => {
    expect(parseOnboarding({ tv: true, analysis: false, kys: true, lesson1: false, desk: true })).toEqual({
      tv: true, analysis: false, kys: true, lesson1: false, desk: true,
    });
  });
  it("treats anything missing or non-boolean as not done", () => {
    expect(parseOnboarding(null)).toEqual(EMPTY_ONBOARDING);
    expect(parseOnboarding({ tv: "yes", kys: 1 })).toEqual(EMPTY_ONBOARDING);
  });
});

describe("deskPitchFor", () => {
  it("tailors step 5 to the KYS archetype", () => {
    expect(deskPitchFor("The Analysis Paralyser")).toMatch(/over-think/);
  });
  it("falls back to the general line", () => {
    expect(deskPitchFor(null)).toBe(ONBOARDING_STEPS[4].blurb);
    expect(deskPitchFor("The Unknown Type")).toBe(ONBOARDING_STEPS[4].blurb);
  });
  it("never promises returns", () => {
    for (const a of ["The Analysis Paralyser", "The Emotional Revenge Trader", "The Reckless Gambler",
      "The Signal Dependent", "The Indicator Stacker", "The System Hopper", "The Brand New Beginner", "The News Trader"]) {
      // Whole words: "learn" contains "earn" and is fine.
      expect(deskPitchFor(a)).not.toMatch(/\b(profits?|profitable|returns?|earns?|earnings|guaranteed?|income)\b/i);
    }
  });
});
