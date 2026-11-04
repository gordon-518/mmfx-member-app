import { describe, it, expect } from "vitest";
import { localeForTag, negotiateLocale } from "./negotiate";
import { fmt, plural } from "./format";
import { isLocale, LOCALES } from "./config";

describe("locale negotiation", () => {
  it("reads the script out of Chinese tags", () => {
    expect(localeForTag("zh-CN")).toBe("zh-Hans");
    expect(localeForTag("zh-SG")).toBe("zh-Hans");
    expect(localeForTag("zh-MY")).toBe("zh-Hans");
    expect(localeForTag("zh")).toBe("zh-Hans");
    expect(localeForTag("zh-TW")).toBe("zh-Hant");
    expect(localeForTag("zh-HK")).toBe("zh-Hant");
    expect(localeForTag("zh-MO")).toBe("zh-Hant");
    // An explicit script subtag beats the region.
    expect(localeForTag("zh-Hant-SG")).toBe("zh-Hant");
    expect(localeForTag("zh-Hans-HK")).toBe("zh-Hans");
  });

  it("knows Malay and both Indonesian codes", () => {
    expect(localeForTag("ms-MY")).toBe("ms");
    expect(localeForTag("id-ID")).toBe("id");
    expect(localeForTag("in-ID")).toBe("id");
  });

  it("returns nothing for a language we don't speak", () => {
    expect(localeForTag("fr-FR")).toBeNull();
  });

  it("honours q-values, then header order", () => {
    expect(negotiateLocale("fr;q=1, zh-TW;q=0.9, en;q=0.8")).toBe("zh-Hant");
    expect(negotiateLocale("en;q=0.5, ms;q=0.9")).toBe("ms");
    expect(negotiateLocale("id, en")).toBe("id");
  });

  it("falls back to English for empty, junk or unsupported headers", () => {
    expect(negotiateLocale(null)).toBe("en");
    expect(negotiateLocale("")).toBe("en");
    expect(negotiateLocale("de-DE,fr;q=0.8")).toBe("en");
    expect(negotiateLocale("zh-TW;q=0")).toBe("en");
  });
});

describe("message formatting", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(fmt("Day {day} · {stage}", { day: 3, stage: "Analysis" })).toBe("Day 3 · Analysis");
    expect(fmt("Hi {name}", {})).toBe("Hi {name}");
    expect(fmt("No vars")).toBe("No vars");
  });

  it("picks the English plural and passes n through", () => {
    expect(plural(1, "{n} lesson", "{n} lessons")).toBe("1 lesson");
    expect(plural(5, "{n} lesson", "{n} lessons")).toBe("5 lessons");
  });

  it("only accepts the five locales", () => {
    for (const l of LOCALES) expect(isLocale(l)).toBe(true);
    expect(isLocale("zh")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
