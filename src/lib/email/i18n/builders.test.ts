import { describe, it, expect } from "vitest";
import { LOCALES } from "@/i18n/config";
import { MONEY_CLAIM } from "@/i18n/moneyClaims";
import { EMAIL_MESSAGES } from ".";
import { en } from "./en";
import { depositDmReminderEmail, depositRejectedEmail, depositVerifiedEmail } from "@/lib/depositEmails";
import { fundamentalEmailHtml, fundamentalEmailSubject } from "@/lib/fundamentalEmail";
import { interventionEmailHtml } from "@/lib/journal/interventionEmail";
import { renderLifecycle } from "@/lib/email/lifecycle";
import type { LifecycleCtx } from "@/lib/email/lifecycle/types";

// The emails outside the lifecycle rail — deposit, Fundamental Desk, the
// AI Trading Assistant's coaching — in every language, with hostile input.

const HOSTILE = '<b>"Sam" & co</b>';
const visible = (html: string) => html.replace(/<[^>]*>/g, " ");

describe("deposit emails in every language", () => {
  for (const locale of LOCALES) {
    const m = EMAIL_MESSAGES[locale];

    it(`${locale}: verified names the tier as it is, in the reader's words`, () => {
      const e = depositVerifiedEmail({ name: HOSTILE, amount: 150, cumulative: 200, tier: "desk", topUp: true, locale });
      expect(e.subject).toBe(m.deposit.verified.subject.replace("{tier}", "Desk"));
      expect(e.html).toContain(`lang="${locale}"`);
      expect(e.html).not.toContain("<b>\"Sam\"");
      expect(e.text).toContain(m.common.signoff);
      expect(e.text).toContain(en.deposit.riskLine);
      expect(e.text).toContain(m.deposit.riskLine);
      expect(e.text).toContain("$150");
      expect(e.text).toContain("$200");
    });

    it(`${locale}: the reminder keeps Admin Amelia and the English message she matches`, () => {
      const e = depositDmReminderEmail({ name: "Wei Ling", amount: 120, ref: "MM-9FBDA4", locale });
      expect(e.subject).toContain("$120");
      expect(e.text).toContain("Admin Amelia");
      expect(e.text).toContain(encodeURIComponent("My reference is MM-9FBDA4."));
      expect(e.html).toContain("<b>MM-9FBDA4</b>");
      // Chinese sentences join without a space after the full stop.
      if (locale.startsWith("zh")) expect(e.text).not.toMatch(/。 /);
    });

    it(`${locale}: rejected quotes the reviewer's reason as typed, escaped in the HTML`, () => {
      const e = depositRejectedEmail({ name: null, amount: 100, reason: HOSTILE, locale });
      expect(e.text).toContain(HOSTILE);
      expect(e.html).toContain("&lt;b&gt;&quot;Sam&quot; &amp; co&lt;/b&gt;");
      expect(e.text.startsWith(m.common.hiNoName)).toBe(true);
    });

    it(`${locale}: no earnings words outside the risk line`, () => {
      for (const e of [
        depositVerifiedEmail({ name: "Wei", amount: 60, cumulative: 60, tier: "foundation", topUp: false, locale }),
        depositDmReminderEmail({ name: "Wei", amount: 60, ref: "MM-000000", locale }),
        depositRejectedEmail({ name: "Wei", amount: 60, reason: "Screenshot unreadable", locale }),
      ]) {
        const body = `${e.subject}\n${visible(e.html)}`.split(en.deposit.riskLine).join(" ").split(m.deposit.riskLine).join(" ");
        expect(body).not.toMatch(MONEY_CLAIM[locale]);
      }
    });
  }
});

describe("the Fundamental Desk copy in every language", () => {
  for (const locale of LOCALES) {
    it(`${locale}: keeps the name, both "not a signal" lines, and escapes the ticker`, () => {
      const html = fundamentalEmailHtml("XAU<USD>", locale);
      expect(fundamentalEmailSubject("XAU/USD", locale)).toContain("XAU/USD");
      expect(html).toContain(`<html lang="${locale}">`);
      expect(html).toContain("Fundamental Desk");
      expect(html).toContain(en.fundamental.compliance);
      expect(html).toContain(EMAIL_MESSAGES[locale].fundamental.compliance);
      expect(html).toContain("XAU&lt;USD&gt;");
      expect(html).not.toContain("XAU<USD>");
    });
  }
});

describe("the coaching email in every language", () => {
  for (const locale of LOCALES) {
    it(`${locale}: frames the coach's lines in the reader's words`, () => {
      const m = EMAIL_MESSAGES[locale];
      const html = interventionEmailHtml({
        headline: HOSTILE, body: "b", action: "a", ctaUrl: "https://app.test/journal", unsubUrl: "https://app.test/u", locale,
      });
      expect(html).toContain(`<html lang="${locale}">`);
      expect(html).toContain(m.journal.doThis);
      expect(html).toContain(m.journal.cta);
      expect(html).toContain(m.journal.footerNote);
      expect(html).toContain(`>${m.shell.unsubscribe}</a>`);
      expect(html).not.toContain(HOSTILE);
    });
  }
});

describe("the digest subject in every language", () => {
  const ctx = (locale: (typeof LOCALES)[number], bias: "bullish" | null): LifecycleCtx => ({
    firstName: "Wei", audience: "expired", tier: "free", trialEndsAt: null, daysSinceSignup: 40,
    onboarding: { tv: true, analysis: true, kys: true, lesson1: true, desk: true },
    todayAnalysis: { title: "Gold holds", bias: bias as "bullish", description: "The range held." },
    appUrl: "https://app.marketmakersfx.net", unsubUrl: "https://app.test/u", locale,
  });
  for (const locale of LOCALES) {
    it(`${locale}: names the bias, and drops it cleanly when there is none`, () => {
      const word = EMAIL_MESSAGES[locale].common.bias.bullish.toLowerCase();
      const withBias = renderLifecycle("nurture", "digest", ctx(locale, "bullish")).subject;
      const without = renderLifecycle("nurture", "digest", ctx(locale, null)).subject;
      expect(withBias).toContain(word);
      expect(withBias).not.toContain("{");
      expect(without).not.toMatch(/[{:：,，]\s*$/);
      expect(without.length).toBeGreaterThan(0);
    });
  }
});
