import { describe, it, expect } from "vitest";
import { brandFromEnv, parseWordmark, parseFeaturesOff, brandCssVars } from "./brand";

describe("brandFromEnv", () => {
  it("with no env is exactly the strings the app used to hard-code", () => {
    const b = brandFromEnv({});
    expect(b.name).toBe("Market Makers FX");
    expect(b.shortName).toBe("MMFX");
    expect(b.wordmark).toEqual({ lead: "Market Makers", accent: "FX" });
    expect(b.domain).toBe("marketmakersfx.net");
    expect(b.appUrl).toBe("https://app.marketmakersfx.net");
    expect(b.appHost).toBe("app.marketmakersfx.net");
    expect(b.supportEmail).toBe("hello@marketmakersfx.net");
    expect(b.postalLine).toBe("Market Makers FX, Singapore");
    expect(b.persona).toBe("Don");
    expect(b.topTierLabel).toBe("Team MM");
    expect([b.accent, b.accentSoft, b.accentInk]).toEqual(["#ff5a1f", "#ffece2", "#c2410c"]);
    expect(b.demo).toBe(false);
    expect(b.featuresOff).toEqual([]);
  });

  it("takes every override and ignores blanks", () => {
    const b = brandFromEnv({
      NEXT_PUBLIC_BRAND_NAME: "Summit Desk",
      NEXT_PUBLIC_BRAND_SHORT: "  ",
      NEXT_PUBLIC_BRAND_WORDMARK: "Summit|Desk",
      NEXT_PUBLIC_BRAND_DOMAIN: "https://summit.example/",
      NEXT_PUBLIC_APP_URL: "https://ib-demo-desk.vercel.app/",
      NEXT_PUBLIC_BRAND_TOP_TIER: " Inner Circle ",
      NEXT_PUBLIC_BRAND_ACCENT: "#0D9488",
      NEXT_PUBLIC_BRAND_ACCENT_SOFT: "not-a-colour",
      NEXT_PUBLIC_BRAND_DEMO: "TRUE",
      NEXT_PUBLIC_BRAND_FEATURES_OFF: "library, signals,bogus,team-mm,signals",
    });
    expect(b.name).toBe("Summit Desk");
    expect(b.shortName).toBe("MMFX");
    expect(b.wordmark).toEqual({ lead: "Summit", accent: "Desk" });
    expect(b.domain).toBe("summit.example");
    expect(b.appUrl).toBe("https://ib-demo-desk.vercel.app");
    expect(b.appHost).toBe("ib-demo-desk.vercel.app");
    expect(b.topTierLabel).toBe("Inner Circle");
    expect(b.accent).toBe("#0d9488");
    expect(b.accentSoft).toBe("#ffece2");
    expect(b.demo).toBe(true);
    expect(b.featuresOff).toEqual(["library", "signals", "team-mm"]);
  });
});

describe("parseWordmark", () => {
  it("falls back, splits on the bar, and tolerates no bar", () => {
    const fb = { lead: "A", accent: "B" };
    expect(parseWordmark(undefined, fb)).toEqual(fb);
    expect(parseWordmark(" Summit | Desk ", fb)).toEqual({ lead: "Summit", accent: "Desk" });
    expect(parseWordmark("Solo", fb)).toEqual({ lead: "Solo", accent: "" });
  });
});

describe("parseFeaturesOff", () => {
  it("keeps only real feature keys, deduped", () => {
    expect(parseFeaturesOff(undefined)).toEqual([]);
    expect(parseFeaturesOff("news,news,nope")).toEqual(["news"]);
  });
});

describe("brandCssVars", () => {
  it("is undefined for the MMFX palette and a var map otherwise", () => {
    expect(brandCssVars(brandFromEnv({}))).toBeUndefined();
    expect(brandCssVars(brandFromEnv({ NEXT_PUBLIC_BRAND_ACCENT: "#0d9488" }))).toEqual({
      "--color-orange": "#0d9488",
      "--color-accent-soft": "#ffece2",
      "--color-accent-ink": "#c2410c",
      "--color-orange-hover": "#c2410c",
    });
  });
});
