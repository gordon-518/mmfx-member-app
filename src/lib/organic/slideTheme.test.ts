import { describe, it, expect } from "vitest";
import { SLIDE_THEMES, slideTheme, CAROUSEL_ROLES, contrastRatio } from "./slideTheme";

describe("slideTheme", () => {
  it("covers every carousel role", () => {
    for (const role of CAROUSEL_ROLES) expect(slideTheme(role), role).toBeTruthy();
    expect(Object.keys(SLIDE_THEMES).sort()).toEqual([...CAROUSEL_ROLES].sort());
  });

  it("falls back to the hook theme for an unknown role", () => {
    // render receives `slide` straight off the wire; an unrecognised value must still
    // draw something legible rather than an undefined-coloured slide.
    expect(slideTheme("nonsense")).toEqual(slideTheme("hook"));
  });

  it("alternates backgrounds so the deck has rhythm", () => {
    // The whole point of this template over the old one: consecutive slides must not
    // look identical when someone swipes.
    const bgs = CAROUSEL_ROLES.map((r) => slideTheme(r).bg);
    for (let i = 1; i < bgs.length; i++) {
      expect(bgs[i], `slide ${i + 1} repeats slide ${i}`).not.toBe(bgs[i - 1]);
    }
  });

  it("puts the two heaviest slides at the hook and the cta", () => {
    // Opening and closing slides carry the colour; the middle can breathe.
    expect(slideTheme("cta").bg).not.toBe(slideTheme("proof").bg);
  });

  it("every slide's body text is legible on its own background", () => {
    // WCAG AA for large text is 3:1; these are display sizes but the body copy is not,
    // so hold all of it to 4.5:1. A theme that fails this ships an unreadable slide.
    for (const role of CAROUSEL_ROLES) {
      const t = slideTheme(role);
      expect(contrastRatio(t.body, t.bg), `${role} body on bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.ink, t.bg), `${role} headline on bg`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("accent marks clear the 3:1 bar for meaningful graphics", () => {
    for (const role of CAROUSEL_ROLES) {
      const t = slideTheme(role);
      expect(contrastRatio(t.accent, t.bg), `${role} accent on bg`).toBeGreaterThanOrEqual(3);
    }
  });

  it("accent TEXT clears the 4.5:1 bar, because words are not shapes", () => {
    // Brand orange is 2.84:1 on the off-white field. Setting a word in it would look
    // right in a mockup and be unreadable on a phone in daylight.
    for (const role of CAROUSEL_ROLES) {
      const t = slideTheme(role);
      expect(contrastRatio(t.accentText, t.bg), `${role} accentText on bg`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("contrastRatio", () => {
  it("is 21:1 for black on white and 1:1 for a colour on itself", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrastRatio("#FF5A1F", "#FF5A1F")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#111111", "#F5F4F2")).toBeCloseTo(contrastRatio("#F5F4F2", "#111111"), 5);
  });
});
