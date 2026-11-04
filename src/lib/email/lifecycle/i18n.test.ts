import { describe, expect, it } from "vitest";
import { LOCALES, type Locale } from "@/i18n/config";
import { MONEY_CLAIM } from "@/i18n/moneyClaims";
import { EMAIL_MESSAGES } from "@/lib/email/i18n";
import { en } from "@/lib/email/i18n/en";
import { ORANGE } from "@/lib/email/ui";
import { renderLifecycle } from "./index";
import type { LifecycleCtx } from "./types";

// Every lifecycle step, rendered in every language the app speaks.

const STEPS: { flow: string; step: string; key: keyof typeof en.lifecycle; audience: LifecycleCtx["audience"] }[] = [
  { flow: "trial", step: "welcome", key: "welcome", audience: "trial" },
  { flow: "trial", step: "analysis", key: "analysis", audience: "trial" },
  { flow: "trial", step: "kys", key: "kys", audience: "trial" },
  { flow: "trial", step: "tv", key: "tv", audience: "trial" },
  { flow: "trial", step: "lesson1", key: "lesson1", audience: "trial" },
  { flow: "trial", step: "ladder", key: "ladder", audience: "trial" },
  { flow: "trial", step: "day12", key: "day12", audience: "trial" },
  { flow: "nurture", step: "digest", key: "digest", audience: "expired" },
  { flow: "nurture", step: "spotlight", key: "spotlight", audience: "expired" },
  { flow: "rescue", step: "upgrade-seen", key: "upgradeSeen", audience: "expired" },
  { flow: "rescue", step: "broker-clicked", key: "brokerClicked", audience: "expired" },
  { flow: "member", step: "member-d3", key: "memberD3", audience: "member" },
  { flow: "member", step: "member-d7", key: "memberD7", audience: "member" },
  { flow: "member", step: "member-dormant", key: "memberDormant", audience: "member" },
];

const SPOTLIGHT = {
  subject: "Liquidity, explained",
  html: "<p>Equal highs are not a level. They are a shelf of stop orders.</p>",
  text: "Equal highs are not a level. They are a shelf of stop orders.",
  guideUrl: "https://www.marketmakersfx.net/guides/liquidity-explained",
};

function ctx(audience: LifecycleCtx["audience"], locale: Locale): LifecycleCtx {
  return {
    firstName: "Wei Ling",
    audience,
    tier: audience === "member" ? "team" : audience === "trial" ? "trial" : "free",
    trialEndsAt: "2026-10-05T00:00:00Z",
    daysSinceSignup: 2,
    onboarding: { tv: false, analysis: true, kys: false, lesson1: false, desk: false },
    todayAnalysis: {
      title: "Gold holds the 4H range high",
      bias: "bullish",
      description: "The range high held into London. Price is pressing it again.",
      coverUrl: "https://cdn.test/covers/2026-09-22.png",
    },
    appUrl: "https://app.marketmakersfx.net",
    unsubUrl: "https://app.marketmakersfx.net/api/email/unsubscribe?token=tok123",
    locale,
    ...({ spotlight: SPOTLIGHT } as Partial<LifecycleCtx>),
  };
}

const BUTTON_CELL = `background:${ORANGE};border-radius:10px`;
const visible = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/g, " ");

describe("lifecycle emails in every language", () => {
  for (const locale of LOCALES) {
    const m = EMAIL_MESSAGES[locale];
    for (const { flow, step, key, audience } of STEPS) {
      describe(`${locale} ${flow}/${step}`, () => {
        const mail = renderLifecycle(flow, step, ctx(audience, locale));
        const words = m.lifecycle[key];

        it("uses the reader's subject, greeting, signature and footer", () => {
          if (step !== "spotlight" || locale !== "en") {
            const subject = words.copy.subject;
            // The digest's subject is a template ("Gold today: {bias}").
            if (!subject.includes("{")) expect(mail.subject).toBe(subject);
          }
          expect(mail.text).toContain(m.common.hi.replace("{name}", "Wei"));
          expect(mail.text).toContain(m.common.signoff);
          expect(mail.html).toContain(`<html lang="${locale}">`);
          expect(mail.html).toContain(`>${m.shell.unsubscribe}</a>`);
          expect(mail.html).toContain(m.shell.footerNote);
        });

        it("keeps the English risk line, with the reader's under it", () => {
          expect(mail.text).toContain(en.shell.riskLine);
          expect(mail.text).toContain(m.shell.riskLine);
        });

        it("still carries exactly one button", () => {
          expect(mail.html.split(BUTTON_CELL).length - 1).toBe(1);
        });

        it("makes no earnings claim in the reader's language", () => {
          const body = `${mail.subject}\n${visible(mail.html)}`
            .split(en.shell.riskLine).join(" ")
            .split(m.shell.riskLine).join(" ");
          expect(body).not.toMatch(MONEY_CLAIM[locale]);
        });

        it("says MM Desk, never a translation of it", () => {
          expect(mail.text).not.toMatch(/\bmeja\b|交易台|分析台/i);
        });
      });
    }

    if (locale === "en") continue;

    it(`${locale}: says the desk writes in English wherever the desk's words appear`, () => {
      for (const step of ["welcome", "analysis", "digest"]) {
        const flow = step === "digest" ? "nurture" : "trial";
        const mail = renderLifecycle(flow, step, ctx(flow === "trial" ? "trial" : "expired", locale));
        expect(mail.text, step).toContain(m.common.deskWritesEnglish);
      }
    });

    it(`${locale}: wraps the brain's English guide in the reader's envelope`, () => {
      const mail = renderLifecycle("nurture", "spotlight", ctx("expired", locale));
      expect(mail.subject).toBe(m.lifecycle.spotlight.copy.subject);
      expect(mail.text).toContain(m.lifecycle.spotlight.guideInEnglish);
      expect(mail.html).toContain(SPOTLIGHT.html);
    });
  }

  it("English keeps the brain's own subject on the spotlight", () => {
    expect(renderLifecycle("nurture", "spotlight", ctx("expired", "en")).subject).toBe(SPOTLIGHT.subject);
  });
});
