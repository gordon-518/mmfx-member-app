import { describe, it, expect } from "vitest";
import { LOCALES } from "@/i18n/config";
import { MONEY_CLAIM, leaves } from "@/i18n/moneyClaims";
import { EMAIL_MESSAGES, emailMessages, riskLines } from ".";
import { en } from "./en";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const ENGLISH = new Map(leaves(en));
const TRANSLATED = LOCALES.filter((l) => l !== "en");

// The risk lines and the "not a signal" line are disclosures: they warn that
// nothing is guaranteed, so they use the very words the scan looks for.
const DISCLOSURES = new Set(["shell.riskLine", "deposit.riskLine", "fundamental.compliance"]);

describe("email words in every language", () => {
  it("fills exactly the English shape", () => {
    for (const locale of LOCALES) {
      expect(leaves(EMAIL_MESSAGES[locale]).map(([path]) => path).sort(), locale).toEqual([...ENGLISH.keys()].sort());
    }
  });

  it("keeps every placeholder the English line has", () => {
    for (const locale of TRANSLATED) {
      for (const [path, text] of leaves(EMAIL_MESSAGES[locale])) {
        expect(placeholders(text), `${locale} ${path}`).toEqual(placeholders(ENGLISH.get(path)!));
      }
    }
  });

  it("is actually translated", () => {
    for (const locale of TRANSLATED) {
      const m = EMAIL_MESSAGES[locale];
      for (const [step, words] of Object.entries(m.lifecycle)) {
        const english = en.lifecycle[step as keyof typeof en.lifecycle].copy;
        expect(words.copy.subject, `${locale} ${step}`).not.toBe(english.subject);
        expect(words.copy.ctaLabel, `${locale} ${step}`).not.toBe(english.ctaLabel);
      }
      // The two notes English leaves empty: the desk and the guides write in English.
      expect(m.common.deskWritesEnglish, locale).not.toBe("");
      expect(m.lifecycle.spotlight.guideInEnglish, locale).not.toBe("");
    }
  });

  it("keeps lifecycle copy inside the limits the variants route enforces", () => {
    for (const locale of LOCALES) {
      for (const [step, words] of Object.entries(EMAIL_MESSAGES[locale].lifecycle)) {
        const { subject, preheader, paragraphs, ctaLabel } = words.copy;
        const where = `${locale} ${step}`;
        expect(subject.length, where).toBeLessThanOrEqual(45);
        expect(preheader.length, where).toBeGreaterThan(0);
        expect(preheader.length, where).toBeLessThanOrEqual(90);
        expect(ctaLabel.length, where).toBeLessThanOrEqual(28);
        expect(ctaLabel, where).not.toMatch(/[→>]\s*$/);
        expect(paragraphs.length, where).toBe(en.lifecycle[step as keyof typeof en.lifecycle].copy.paragraphs.length);
      }
    }
  });

  it("makes no earnings claims in any language", () => {
    for (const locale of LOCALES) {
      const offending = leaves(EMAIL_MESSAGES[locale])
        .filter(([path]) => !DISCLOSURES.has(path))
        .filter(([, text]) => MONEY_CLAIM[locale].test(text));
      expect(offending, locale).toEqual([]);
    }
  });

  it("keeps MM Desk, Fundamental Desk and the tier names in English", () => {
    for (const locale of TRANSLATED) {
      const all = leaves(EMAIL_MESSAGES[locale]);
      expect(all.filter(([, s]) => /\bmeja\b|交易台|分析台/i.test(s)), locale).toEqual([]);
      const byPath = new Map(all);
      for (const [path, english] of ENGLISH) {
        for (const name of ["Fundamental Desk", "Team MM", "TradingView", "XAU/USD", "Admin Amelia"]) {
          if (english.includes(name)) expect(byPath.get(path), `${locale} ${path} keeps ${name}`).toContain(name);
        }
      }
    }
  });

  it("keeps the paid tier names as they are", () => {
    for (const locale of LOCALES) {
      const { foundation, desk, team } = EMAIL_MESSAGES[locale].ladder.rungs;
      expect([foundation.name, desk.name, team.name], locale).toEqual(["Foundation", "Desk", "Team MM"]);
    }
  });

  it("is signed by Don in every language, and never by Gordon", () => {
    for (const locale of LOCALES) {
      expect(EMAIL_MESSAGES[locale].common.signoff, locale).toContain("Don");
      expect(leaves(EMAIL_MESSAGES[locale]).filter(([, s]) => /gordon/i.test(s)), locale).toEqual([]);
    }
  });

  it("falls back to English for a locale it doesn't know", () => {
    expect(emailMessages()).toBe(en);
    expect(emailMessages("xx" as never)).toBe(en);
  });

  it("keeps the English risk line first, with the reader's language under it", () => {
    expect(riskLines("en", (m) => m.shell.riskLine)).toEqual([en.shell.riskLine]);
    const ms = riskLines("ms", (m) => m.shell.riskLine);
    expect(ms[0]).toBe(en.shell.riskLine);
    expect(ms).toHaveLength(2);
  });
});
