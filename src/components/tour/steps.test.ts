import { describe, it, expect } from "vitest";
import { TOUR_STEPS } from "./steps";

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
      expect(s.title.length, s.key).toBeGreaterThan(4);
      expect(s.body.length, s.key).toBeGreaterThan(60);
      expect(s.body, s.key).not.toMatch(/\b(profits?|profitable|returns?|earns?|guaranteed?)\b/i);
    }
  });
});
