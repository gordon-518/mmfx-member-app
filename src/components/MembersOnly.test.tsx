import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LOCALES, type Locale } from "@/i18n/config";
import { MESSAGES } from "@/i18n/messages";
import { fmt } from "@/i18n/format";
import type { MemberTier } from "@/lib/tiers";

// MembersOnly is a server component: its strings come from getT(), the
// request's dictionary, not from the I18nProvider context the client
// components read. So the language is pinned by standing in for getT.
const lang = vi.hoisted(() => ({ locale: "en" as Locale }));
vi.mock("@/i18n/server", async () => {
  const { MESSAGES } = await vi.importActual<typeof import("@/i18n/messages")>("@/i18n/messages");
  return { getT: async () => MESSAGES[lang.locale] };
});

import { MembersOnly } from "./MembersOnly";

/** The Team MM panel as a reader sees it: tags dropped, React's escapes undone. */
async function panel(earnedTier: MemberTier, locale: Locale = "en"): Promise<string> {
  lang.locale = locale;
  const t = MESSAGES[locale];
  const html = renderToStaticMarkup(
    await MembersOnly({ feature: t.tiers.team, blurb: t.teamMm.lockedBlurb, earnedTier })
  );
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

describe("MembersOnly: the note under the button", () => {
  it("tells a viewer on a live trial that they're on a free trial", async () => {
    expect(await panel("trial")).toContain(
      "You're on a free trial — fund your own broker account to unlock everything."
    );
  });

  it("tells a viewer whose trial has ended that they're on Free, not on a trial", async () => {
    const out = await panel("free");
    expect(out).toContain("You're on Free — fund your own broker account to unlock everything.");
    expect(out).not.toContain("free trial");
  });

  it("tells a paying member below Team MM their tier, and that their deposits so far count", async () => {
    const foundation = await panel("foundation");
    expect(foundation).toContain(
      "You're on Foundation — your deposits so far count toward Team MM, so you only need to top up the difference."
    );
    expect(foundation).not.toContain("free trial");
    expect(await panel("desk")).toContain("You're on Desk — your deposits so far count toward Team MM");
  });

  it("says the right thing to each viewer in every language, with the names filled in", async () => {
    for (const locale of LOCALES) {
      const l = MESSAGES[locale].locked;
      const trial = await panel("trial", locale);
      const free = await panel("free", locale);
      const desk = await panel("desk", locale);

      expect(trial, locale).toContain(l.trialNote);
      expect(free, locale).toContain(l.freeNote);
      expect(free, locale).not.toContain(l.trialNote);
      expect(desk, locale).toContain(fmt(l.paidNote, { tier: "Desk", feature: "Team MM" }));
      expect(desk, locale).not.toContain(l.trialNote);
      expect(desk, `${locale}: a placeholder left unfilled`).not.toMatch(/\{\w+\}/);
    }
  });

  it("has its own words in each language, not the English", () => {
    const en = MESSAGES.en.locked;
    for (const locale of LOCALES.filter((x) => x !== "en")) {
      const l = MESSAGES[locale].locked;
      expect(l.freeNote, locale).not.toBe(en.freeNote);
      expect(l.paidNote, locale).not.toBe(en.paidNote);
      expect(new Set([l.trialNote, l.freeNote, l.paidNote]).size, locale).toBe(3);
    }
  });
});
