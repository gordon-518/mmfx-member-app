import { describe, it, expect } from "vitest";
import { LOCALES } from "./config";
import { MESSAGES } from "./messages";
import { MONEY_CLAIM, leaves } from "./moneyClaims";
import { INDICATORS } from "@/app/indicators/data";
import { STRATEGIES } from "@/app/strategies/data";
import { EBOOKS } from "@/app/library/ebooks";

const typeKey = (type: string) => type.replace(/[^A-Za-z]/g, "");

describe("content pages in every language", () => {
  it("cover every indicator, strategy and book", () => {
    for (const locale of LOCALES) {
      const t = MESSAGES[locale];
      for (const i of INDICATORS) {
        expect(Object.keys(t.indicators.signals), `${locale} ${i.slug}`).toContain(i.slug);
        expect(Object.keys(t.indicators.types), `${locale} ${i.type}`).toContain(typeKey(i.type));
      }
      for (const s of STRATEGIES) {
        expect(Object.keys(t.strategies.signals), `${locale} ${s.slug}`).toContain(s.slug);
        expect(Object.keys(t.strategies.types), `${locale} ${s.type}`).toContain(typeKey(s.type));
      }
      for (const b of EBOOKS) {
        expect(Object.keys(t.library.books), `${locale} ${b.slug}`).toContain(b.slug);
        expect(t.library.categories[b.categoryKey], `${locale} ${b.categoryKey}`).toBeTruthy();
      }
    }
  });

  it("the flagship's 'what's inside' has the same number of lines everywhere", () => {
    const flagship = EBOOKS.find((b) => b.featured)!;
    for (const locale of LOCALES) {
      const inside = (MESSAGES[locale].library.books as Record<string, { inside?: Record<string, string> }>)[flagship.slug].inside;
      expect(Object.keys(inside ?? {}), locale).toHaveLength(flagship.whatsInside!.length);
    }
  });

  // Promotional and page copy. common.riskNotice / toolsDisclaimer are the risk
  // warnings themselves ("no returns are guaranteed") and are deliberately not
  // scanned; nor are lesson descriptions, which teach about taking profit.
  const PROMOTIONAL = [
    "signals", "locked", "teamMm", "library", "indicators", "strategies", "liveClasses",
    "calendar", "course", "tour", "dailyAnalysis", "tv", "plans", "upgrade",
    "welcome", "dashboard", "rails", "auth", "status", "tiers", "nav", "skillTrack", "news", "legal",
  ] as const;

  it("makes no earnings claims in any language", () => {
    for (const locale of LOCALES) {
      for (const ns of PROMOTIONAL) {
        const offending = leaves(MESSAGES[locale][ns]).filter(([, s]) => MONEY_CLAIM[locale].test(s));
        expect(offending, `${locale}/${ns}`).toEqual([]);
      }
    }
  });
});
