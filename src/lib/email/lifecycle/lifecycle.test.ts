import { describe, it, expect } from "vitest";
import { emailLintText, lintEmail } from "@/lib/email/compliance";
import type { LifecycleCtx, LifecycleTemplate } from "./types";

import analysis from "./templates/analysis";
import brokerClicked from "./templates/broker-clicked";
import day12 from "./templates/day12";
import kys from "./templates/kys";
import ladder from "./templates/ladder";
import lesson1 from "./templates/lesson1";
import memberD3 from "./templates/member-d3";
import memberD7 from "./templates/member-d7";
import memberDormant from "./templates/member-dormant";
import spotlight from "./templates/spotlight";
import tv from "./templates/tv";
import upgradeSeen from "./templates/upgrade-seen";

// The twelve this branch owns (welcome and digest belong to the rail branch),
// each with the cid its links must carry.
const TEMPLATES: { step: string; cid: string; render: LifecycleTemplate }[] = [
  { step: "analysis", cid: "EML-trial-analysis", render: analysis },
  { step: "kys", cid: "EML-trial-kys", render: kys },
  { step: "tv", cid: "EML-trial-tv", render: tv },
  { step: "lesson1", cid: "EML-trial-lesson1", render: lesson1 },
  { step: "ladder", cid: "EML-trial-ladder", render: ladder },
  { step: "day12", cid: "EML-trial-day12", render: day12 },
  { step: "spotlight", cid: "EML-nurture-spotlight", render: spotlight },
  { step: "upgrade-seen", cid: "EML-hot-upgrade-seen", render: upgradeSeen },
  { step: "broker-clicked", cid: "EML-hot-broker-clicked", render: brokerClicked },
  { step: "member-d3", cid: "EML-member-d3", render: memberD3 },
  { step: "member-d7", cid: "EML-member-d7", render: memberD7 },
  { step: "member-dormant", cid: "EML-member-dormant", render: memberDormant },
];

const SPOTLIGHT = {
  subject: "Liquidity, explained",
  html: "<p>Equal highs are not a level. They are a shelf of stop orders, and price tends to go and take them before it does anything else.</p>",
  text: "Equal highs are not a level. They are a shelf of stop orders, and price tends to go and take them before it does anything else.",
  guideUrl: "https://www.marketmakersfx.net/guides/liquidity-explained",
};

function ctx(over: Partial<LifecycleCtx> & Record<string, unknown> = {}): LifecycleCtx {
  return {
    firstName: "Alex",
    audience: "trial",
    tier: "trial",
    trialEndsAt: "2026-10-05T00:00:00.000Z",
    daysSinceSignup: 1,
    onboarding: { tv: false, analysis: false, kys: false, lesson1: false, desk: false },
    todayAnalysis: { title: "Gold into the London open", bias: "bullish", description: null },
    appUrl: "https://app.marketmakersfx.net",
    unsubUrl: "https://app.marketmakersfx.net/api/email/unsubscribe?token=abc",
    spotlight: SPOTLIGHT,
    ...over,
  } as LifecycleCtx;
}

// Three readers the cron actually has: someone one day into the trial who has
// done nothing, someone two days from the end of it, and a member who stopped
// showing up. Trailing slash on one appUrl on purpose.
const FIXTURES: { name: string; ctx: LifecycleCtx }[] = [
  { name: "fresh trial", ctx: ctx() },
  {
    name: "day-12 trial",
    ctx: ctx({
      firstName: null,
      daysSinceSignup: 12,
      onboarding: { tv: true, analysis: true, kys: false, lesson1: false, desk: false },
      todayAnalysis: null,
      appUrl: "https://app.marketmakersfx.net/",
    }),
  },
  {
    name: "dormant member",
    ctx: ctx({
      firstName: "Sam O'Neill",
      audience: "member",
      tier: "team",
      trialEndsAt: null,
      daysSinceSignup: 64,
      onboarding: { tv: true, analysis: true, kys: true, lesson1: true, desk: true },
    }),
  },
];

const HREF = /href="([^"]*)"/g;

// The house bans, beyond what the vendored gate catches: the gate blocks a
// PROMISED return, this blocks the vocabulary outright.
const CLAIM = /\b(profits?|profitable|returns?|gains?|income|earnings?|win[-\s]?rate)\b|\d\s*%/i;
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const SHOUTING = /\b[A-Z]{3,}\b/;

describe("lifecycle templates", () => {
  for (const { step, cid, render } of TEMPLATES) {
    describe(step, () => {
      for (const fixture of FIXTURES) {
        const email = render(fixture.ctx);
        const stripped = emailLintText(email.html);

        it(`passes the compliance gate — ${fixture.name}`, () => {
          expect(lintEmail(email.subject)).toEqual({ verdict: "pass", hits: [] });
          expect(lintEmail(email.text)).toEqual({ verdict: "pass", hits: [] });
          expect(lintEmail(stripped)).toEqual({ verdict: "pass", hits: [] });
        });

        it(`makes no performance claim — ${fixture.name}`, () => {
          expect(email.subject).not.toMatch(CLAIM);
          expect(email.text).not.toMatch(CLAIM);
          expect(stripped).not.toMatch(CLAIM);
        });

        it(`attributes every link — ${fixture.name}`, () => {
          const hrefs = [...email.html.matchAll(HREF)].map((m) => m[1]);
          expect(hrefs.length).toBeGreaterThan(0);
          for (const href of hrefs) expect(href).toContain("cid=EML-");
          expect(email.html).toContain(cid);
          expect(email.text).toContain(cid);
        });

        it(`keeps the house shape — ${fixture.name}`, () => {
          expect(email.subject.length).toBeLessThanOrEqual(55);
          expect(email.subject).not.toMatch(EMOJI);
          expect(email.subject).not.toMatch(SHOUTING);
          expect(email.text).not.toMatch(EMOJI);
          expect(email.text).toContain("— Don, Market Makers FX");
          expect(email.html).toContain("— Don, Market Makers FX");
          // A body fragment: the rail's shell owns the document and the footer.
          expect(email.html).not.toContain("<html");
          expect(email.html).not.toContain("<img");
          expect(email.html).not.toContain(fixture.ctx.unsubUrl);
          // "MMFX" is an internal name; readers get "Market Makers".
          expect(email.subject).not.toContain("MMFX");
          expect(stripped).not.toContain("MMFX");
          expect(stripped).not.toContain("Gordon");
          // A real text version, not a strip of the HTML.
          expect(email.text).not.toContain("<p");
          expect(email.text.length).toBeGreaterThan(200);
        });

        it(`greets by first name only — ${fixture.name}`, () => {
          const expected = fixture.ctx.firstName ? `Hi ${fixture.ctx.firstName.split(" ")[0]},` : "Hi,";
          expect(email.text.startsWith(expected)).toBe(true);
        });
      }
    });
  }

  it("has exactly the twelve steps this branch owns", () => {
    expect(TEMPLATES.map((t) => t.step)).toHaveLength(12);
    expect(new Set(TEMPLATES.map((t) => t.cid)).size).toBe(12);
  });
});

describe("analysis", () => {
  it("names today's read when there is one, and does not invent one when there isn't", () => {
    expect(analysis(ctx()).text).toContain("Gold into the London open, bias bullish.");
    expect(analysis(ctx({ todayAnalysis: null })).text).toContain("The next one goes up before the session.");
  });

  it("escapes a title in the HTML", () => {
    const e = analysis(ctx({ todayAnalysis: { title: "<b>Gold</b> & the dollar", bias: "neutral", description: null } }));
    expect(e.html).toContain("&lt;b&gt;Gold&lt;/b&gt; &amp; the dollar");
    expect(e.html).not.toContain("<b>Gold</b>");
  });
});

describe("spotlight", () => {
  it("wraps what the brain approved, and carries the guide link", () => {
    const e = spotlight(ctx());
    expect(e.subject).toBe("Liquidity, explained");
    expect(e.html).toContain("shelf of stop orders");
    expect(e.html).toContain("liquidity-explained?cid=EML-nurture-spotlight");
  });

  it("keeps a cid the brain already put on the guide url", () => {
    const e = spotlight(ctx({ spotlight: { ...SPOTLIGHT, guideUrl: `${SPOTLIGHT.guideUrl}?cid=EML-nurture-week7` } }));
    expect(e.html).toContain("cid=EML-nurture-week7");
    expect(e.html).not.toContain("cid=EML-nurture-spotlight");
  });

  it("falls back to the free feature rather than throwing on a missing payload", () => {
    const e = spotlight(ctx({ spotlight: undefined }));
    expect(e.subject).toBe("From the desk this week");
    expect(lintEmail(e.text)).toEqual({ verdict: "pass", hits: [] });
    expect(e.html).toContain("cid=EML-nurture-spotlight");
  });
});

describe("the ladder copy", () => {
  it("says the deposit is the trader's own capital, in both flows that explain it", () => {
    for (const e of [ladder(ctx()), upgradeSeen(ctx())]) {
      expect(e.text).toContain("in your name");
      expect(e.text).toMatch(/withdraw it/);
      expect(e.text).toMatch(/not (?:a fee|paid to Market Makers)/);
    }
  });

  it("names all four rungs and their thresholds", () => {
    const t = ladder(ctx()).text;
    for (const s of ["Free", "Foundation", "$50", "Desk", "$200", "Team MM", "$500"]) expect(t).toContain(s);
  });

  it("tells day-12 readers what the free tier keeps", () => {
    const t = day12(ctx({ daysSinceSignup: 12 })).text;
    expect(t).toContain("day 14");
    for (const s of ["Daily Analysis", "Know Your Style", "Module 1", "signals channel"]) expect(t).toContain(s);
  });
});

describe("broker-clicked", () => {
  it("points at the real admin contact, not an invented one", () => {
    const t = brokerClicked(ctx()).text;
    expect(t).toContain("Admin Amelia");
    expect(t).toContain("https://t.me/MM_3000");
  });
});
