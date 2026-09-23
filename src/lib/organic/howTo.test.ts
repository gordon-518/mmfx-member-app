import { describe, it, expect } from "vitest";
import { HOWTO_ROLES, stepIndex, themeForRole, howToSlides } from "./howTo";
import { contrastRatio } from "./slideTheme";

describe("HOWTO_ROLES", () => {
  it("is a hook, four steps and a cta", () => {
    expect(HOWTO_ROLES).toEqual(["hook", "step1", "step2", "step3", "step4", "cta"]);
  });
});

describe("stepIndex", () => {
  it("reads the number out of a step role", () => {
    expect(stepIndex("step1")).toBe(1);
    expect(stepIndex("step4")).toBe(4);
  });

  it("returns null for roles that are not steps", () => {
    // The hook and cta are not numbered — drawing "00" on them would be nonsense.
    expect(stepIndex("hook")).toBeNull();
    expect(stepIndex("cta")).toBeNull();
    expect(stepIndex("nonsense")).toBeNull();
  });
});

describe("themeForRole", () => {
  it("gives every role a theme", () => {
    for (const r of HOWTO_ROLES) expect(themeForRole(r), r).toBeTruthy();
  });

  it("never repeats a background on consecutive slides", () => {
    // Six slides that look alike is the failure this whole template style exists to fix.
    const bgs = HOWTO_ROLES.map((r) => themeForRole(r).bg);
    for (let i = 1; i < bgs.length; i++) {
      expect(bgs[i], `slide ${i + 1} repeats slide ${i}`).not.toBe(bgs[i - 1]);
    }
  });

  it("keeps every slide legible", () => {
    for (const r of HOWTO_ROLES) {
      const t = themeForRole(r);
      expect(contrastRatio(t.ink, t.bg), `${r} headline`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.body, t.bg), `${r} body`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("falls back rather than returning undefined for an unknown role", () => {
    expect(themeForRole("nope")).toEqual(themeForRole("hook"));
  });
});

describe("howToSlides", () => {
  const slots = {
    hook: "Connect your account in four steps",
    step1: "Log in to the app",
    step2: "Open the AI Trading Assistant",
    step3: "Enter your MT5 investor password",
    step4: "Wait for the read, then check your stats",
    cta: "Free in the app",
  };

  it("returns one renderable slide per filled role", () => {
    expect(howToSlides(slots).map((s) => s.role)).toEqual(HOWTO_ROLES);
  });

  it("drops trailing steps that were not written", () => {
    // Three steps is a legitimate how-to. A blank fourth slide is not.
    const three = { ...slots, step4: "" };
    expect(howToSlides(three).map((s) => s.role)).toEqual([
      "hook", "step1", "step2", "step3", "cta",
    ]);
  });

  it("renumbers so the steps a reader sees are 1..n with no gap", () => {
    // If step2 is blank, the reader must see 1, 2, 3 — not 1, 3, 4.
    const gapped = { ...slots, step2: "" };
    const steps = howToSlides(gapped).filter((s) => s.step !== null);
    expect(steps.map((s) => s.step)).toEqual([1, 2, 3]);
    expect(steps.map((s) => s.text)).toEqual([
      "Log in to the app",
      "Enter your MT5 investor password",
      "Wait for the read, then check your stats",
    ]);
  });

  it("always keeps the hook and the cta", () => {
    const bare = { hook: "H", cta: "C" };
    expect(howToSlides(bare).map((s) => s.role)).toEqual(["hook", "cta"]);
  });

  it("reports the total so a slide can say 'step 2 of 3'", () => {
    const three = { ...slots, step4: "" };
    for (const s of howToSlides(three)) expect(s.totalSteps).toBe(3);
  });
});

describe("howToSlides — screenshots", () => {
  const withImages = {
    hook: "Your MT5 account, read in four steps.",
    step1: "Log in to the app", step1Image: "https://cdn.example/1.png",
    step2: "Open the AI Trading Assistant", step2Image: "https://cdn.example/2.png",
    step3: "Enter your investor password", step3Image: "https://cdn.example/3.png",
    step4: "See which habit is costing you", step4Image: "https://cdn.example/4.png",
    cta: "Free in the app",
  };

  it("attaches each step's image to that step", () => {
    const steps = howToSlides(withImages).filter((s) => s.step !== null);
    expect(steps.map((s) => s.image)).toEqual([
      "https://cdn.example/1.png",
      "https://cdn.example/2.png",
      "https://cdn.example/3.png",
      "https://cdn.example/4.png",
    ]);
  });

  it("keeps an image with its own step when earlier steps are dropped", () => {
    // THE SUBTLE ONE. Blank step2 renumbers step3 to "2" — its image must travel with
    // it. Reading the image by the RENDERED number would show step 3's screenshot
    // captioned with step 3's text under the numeral 2, which is right, while step 4's
    // image would be lost. Reading by slot keeps text and picture together.
    const gapped = { ...withImages, step2: "" };
    const steps = howToSlides(gapped).filter((s) => s.step !== null);
    expect(steps.map((s) => s.step)).toEqual([1, 2, 3]);
    expect(steps.map((s) => s.text)).toEqual([
      "Log in to the app",
      "Enter your investor password",
      "See which habit is costing you",
    ]);
    expect(steps.map((s) => s.image)).toEqual([
      "https://cdn.example/1.png",
      "https://cdn.example/3.png",
      "https://cdn.example/4.png",
    ]);
  });

  it("a step without an image is still a valid step", () => {
    // Mixed carousels are fine: a screenshot where one helps, type where it does not.
    const mixed = { ...withImages, step2Image: "" };
    const steps = howToSlides(mixed).filter((s) => s.step !== null);
    expect(steps[1].image).toBeNull();
    expect(steps[1].text).toBe("Open the AI Trading Assistant");
  });

  it("ignores an image slot whose step was never written", () => {
    const orphan = { hook: "H", cta: "C", step3Image: "https://cdn.example/x.png" };
    expect(howToSlides(orphan).map((s) => s.role)).toEqual(["hook", "cta"]);
  });

  it("the hook and the cta can carry images too", () => {
    const s = howToSlides({ ...withImages, hookImage: "https://cdn.example/h.png" });
    expect(s[0].image).toBe("https://cdn.example/h.png");
  });
});
