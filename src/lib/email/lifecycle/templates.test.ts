import { describe, expect, it } from "vitest";
import { COMPLIANCE_LINE, DEFAULT_COPY, FLOWS, renderLifecycle, templateFor } from "./index";
import { url } from "./copy";
import { emailLintText, lintEmail } from "@/lib/email/compliance";
import { escapeHtml } from "@/lib/email/shell";
import { ORANGE } from "@/lib/email/ui";
import welcome from "./templates/welcome";
import digest from "./templates/digest";
import type { LifecycleCopy, LifecycleCtx } from "./types";

/** The button's own cell. The bias badge is orange too, so "one button" has
 *  to be counted on something only the button has. */
const BUTTON_CELL = `background:${ORANGE};border-radius:10px`;

const BASE: LifecycleCtx = {
  firstName: "Wei",
  audience: "trial",
  tier: "trial",
  trialEndsAt: "2026-10-05T00:00:00Z",
  daysSinceSignup: 0,
  onboarding: { tv: false, analysis: false, kys: false, lesson1: false, desk: false },
  todayAnalysis: {
    title: "Gold holds the 4H range high",
    bias: "bullish",
    description: "Price is pressing the range high into London.",
  },
  appUrl: "https://app.marketmakersfx.net",
  unsubUrl: "https://app.marketmakersfx.net/api/email/unsubscribe?token=tok123",
};

function ctx(over: Partial<LifecycleCtx> = {}): LifecycleCtx {
  return { ...BASE, ...over };
}

/** Every href a READER can follow. The shell v2 <head> also links the Google
 *  Fonts stylesheet, which is not a link in the email's sense. */
function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((h) => !h.startsWith("https://fonts.googleapis.com/"));
}

// The words compliance says never appear in Market Makers marketing copy:
// outcome claims, and pressure. Checked on both renderings of both proof
// templates, wrapped, so the shell and the risk line are in scope too.
const BANNED = [
  "guaranteed",
  "guarantee",
  "risk-free",
  "riskfree",
  "profit",
  "returns",
  "win rate",
  "win-rate",
  "winrate",
  "last chance",
  "hurry",
  "don't miss",
  "dont miss",
  "act now",
  "limited time",
];

function assertCompliant(mail: { subject: string; html: string; text: string }) {
  const haystack = `${mail.subject}\n${mail.text}`.toLowerCase();
  for (const word of BANNED) {
    expect(haystack, `banned phrase "${word}"`).not.toContain(word);
  }
  // The copy, not the markup — strip tags so width="100%" isn't a false hit.
  const visible = mail.html.replace(/<[^>]*>/g, " ").toLowerCase();
  for (const word of BANNED) {
    expect(visible, `banned phrase "${word}" in html`).not.toContain(word);
  }
  expect(visible).not.toMatch(/\d\s*%/);
  expect(mail.text).toContain("— Don, Market Makers FX");
  expect(mail.text).toContain(COMPLIANCE_LINE);
}

describe("welcome template", () => {
  it("says what it is, how it stays free, and asks for one action", () => {
    const mail = renderLifecycle("trial", "welcome", ctx());
    expect(mail.subject).toBe("Start with today's gold read");
    expect(mail.text).toContain("Hi Wei,");
    expect(mail.text).toContain("introducing broker");
    expect(mail.text).toContain("14-day trial");
    expect(mail.text).toContain("Module 1 of the course");
    assertCompliant(mail);
  });

  it("puts today's title and bias inline", () => {
    const mail = renderLifecycle("trial", "welcome", ctx());
    expect(mail.html).toContain("Gold holds the 4H range high");
    expect(mail.html).toContain("Bullish bias");
    expect(mail.text).toContain("Gold holds the 4H range high");
  });

  it("still renders when no analysis is published yet", () => {
    const mail = renderLifecycle("trial", "welcome", ctx({ todayAnalysis: null }));
    expect(mail.html).toContain("Asian session");
    assertCompliant(mail);
  });

  it("greets without a name when we don't have one", () => {
    expect(welcome(ctx({ firstName: null })).text).toContain("Hi,");
  });

  it("escapes an analysis title that carries markup", () => {
    const mail = welcome(
      ctx({ todayAnalysis: { title: "<b>XAU</b>", bias: "neutral", description: null } })
    );
    expect(mail.html).not.toContain("<b>XAU</b>");
    expect(mail.html).toContain("&lt;b&gt;XAU&lt;/b&gt;");
  });

  it("carries one call to action, tagged with the step's cid", () => {
    const body = welcome(ctx());
    // The button emits its href twice — once for the <a>, once for the VML
    // twin Outlook needs — so what matters is that there is one destination.
    expect([...new Set(hrefs(body.html))]).toEqual([
      "https://app.marketmakersfx.net/daily-analysis?cid=EML-trial-welcome",
    ]);
    expect(body.text).toContain("cid=EML-trial-welcome");
  });
});

describe("digest template", () => {
  const free = ctx({ audience: "expired", tier: "free", daysSinceSignup: 40 });

  it("leads with today's read and says what Free keeps", () => {
    const mail = renderLifecycle("nurture", "digest", free);
    expect(mail.subject).toBe("Gold today: bullish");
    // v2: the bias is a badge, not a sentence — but the text twin still says it.
    expect(mail.html).toContain("BULLISH");
    expect(mail.text).toContain("Bias: Bullish");
    expect(mail.text).toContain("Price is pressing the range high into London.");
    expect(mail.text).toContain("free account");
    expect(mail.text).toContain("Module 1 of the MM System course");
    assertCompliant(mail);
  });

  it("falls back to a generic headline with no analysis row", () => {
    const mail = renderLifecycle("nurture", "digest", ctx({ ...free, todayAnalysis: null }));
    expect(mail.subject).toBe("Gold today");
    assertCompliant(mail);
  });

  it("carries one call to action, tagged with the digest cid", () => {
    expect([...new Set(hrefs(digest(free).html))]).toEqual([
      "https://app.marketmakersfx.net/daily-analysis?cid=EML-nurture-digest",
    ]);
  });
});

describe("renderLifecycle", () => {
  it("wraps the body in the branded shell with an unsubscribe link", () => {
    const mail = renderLifecycle("trial", "welcome", ctx());
    expect(mail.html).toContain("<!doctype html>");
    expect(mail.html).toContain("MARKET MAKERS FX");
    expect(hrefs(mail.html)).toContain(
      "https://app.marketmakersfx.net/api/email/unsubscribe?token=tok123"
    );
  });

  it("appends the risk line exactly once, to both renderings", () => {
    const mail = renderLifecycle("nurture", "digest", ctx({ audience: "expired", tier: "free" }));
    expect(mail.text.split(COMPLIANCE_LINE)).toHaveLength(2);
    expect(mail.html.split("Trading involves risk")).toHaveLength(2);
  });

  it("tags every link except the unsubscribe one with the step's cid", () => {
    const mail = renderLifecycle("trial", "welcome", ctx());
    for (const href of hrefs(mail.html)) {
      if (href.includes("/api/email/unsubscribe")) continue;
      expect(href).toContain("cid=EML-trial-welcome");
    }
  });

  it("throws for a pair no flow knows", () => {
    expect(() => renderLifecycle("trial", "nope", ctx())).toThrow(/no lifecycle template/);
  });
});

describe("registry", () => {
  it("resolves the two written templates", () => {
    expect(templateFor("trial", "welcome")).toBe(welcome);
    expect(templateFor("nurture", "digest")).toBe(digest);
  });

  it("returns null for a pair that isn't in any flow", () => {
    expect(templateFor("trial", "nope")).toBeNull();
    expect(templateFor("nope", "welcome")).toBeNull();
  });

  it("renders every registered step without throwing", () => {
    // No stubs: a template that throws inside the cron loop is a render
    // failure the route has to unwind, so every registered pair must render.
    for (const [flow, steps] of Object.entries(FLOWS)) {
      for (const step of Object.keys(steps)) {
        const mail = renderLifecycle(flow, step, ctx({ audience: "expired", tier: "free" }));
        expect(mail.subject.length, `${flow}/${step} subject`).toBeGreaterThan(0);
        expect(mail.html, `${flow}/${step} html`).toContain("MARKET MAKERS FX");
        expect(mail.text, `${flow}/${step} text`).toContain(COMPLIANCE_LINE);
      }
    }
  });

  it("registers exactly the fourteen steps the design doc names", () => {
    const steps = Object.values(FLOWS).flatMap((f) => Object.keys(f)).sort();
    expect(steps).toEqual(
      [
        "analysis", "broker-clicked", "day12", "digest", "kys", "ladder",
        "lesson1", "member-d3", "member-d7", "member-dormant", "spotlight",
        "tv", "upgrade-seen", "welcome",
      ].sort()
    );
  });
});

describe("url()", () => {
  it("builds an absolute in-app link carrying EML-<flow>-<step>", () => {
    expect(url(ctx(), "/indicators", "trial-tv")).toBe(
      "https://app.marketmakersfx.net/indicators?cid=EML-trial-tv"
    );
  });

  it("tolerates a trailing slash on appUrl", () => {
    expect(url(ctx({ appUrl: "https://app.test/" }), "/x", "a-b")).toBe(
      "https://app.test/x?cid=EML-a-b"
    );
  });
});

// --- v2 structure (plan §0.2, design §3 "Per-template structure") -----------
//
// One sweep over all fourteen steps. Everything here is a house rule that is
// cheaper to enforce than to remember: the copy limits the variants route also
// enforces, the preheader that every v1 template forgot, exactly one button,
// the module each step is supposed to carry, and the compliance gate on both
// renderings.

const STEPS: { flow: string; step: string; cid: string }[] = [
  { flow: "trial", step: "welcome", cid: "EML-trial-welcome" },
  { flow: "trial", step: "analysis", cid: "EML-trial-analysis" },
  { flow: "trial", step: "kys", cid: "EML-trial-kys" },
  { flow: "trial", step: "tv", cid: "EML-trial-tv" },
  { flow: "trial", step: "lesson1", cid: "EML-trial-lesson1" },
  { flow: "trial", step: "ladder", cid: "EML-trial-ladder" },
  { flow: "trial", step: "day12", cid: "EML-trial-day12" },
  { flow: "nurture", step: "digest", cid: "EML-nurture-digest" },
  { flow: "nurture", step: "spotlight", cid: "EML-nurture-spotlight" },
  { flow: "rescue", step: "upgrade-seen", cid: "EML-hot-upgrade-seen" },
  { flow: "rescue", step: "broker-clicked", cid: "EML-hot-broker-clicked" },
  { flow: "member", step: "member-d3", cid: "EML-member-d3" },
  { flow: "member", step: "member-d7", cid: "EML-member-d7" },
  { flow: "member", step: "member-dormant", cid: "EML-member-dormant" },
];

const AUDIENCE: Record<string, LifecycleCtx["audience"]> = {
  trial: "trial",
  nurture: "expired",
  rescue: "expired",
  member: "member",
};

const SPOTLIGHT = {
  subject: "Liquidity, explained",
  html: "<p>Equal highs are not a level. They are a shelf of stop orders.</p>",
  text: "Equal highs are not a level. They are a shelf of stop orders.",
  guideUrl: "https://www.marketmakersfx.net/guides/liquidity-explained",
};

function stepCtx(flow: string, over: Partial<LifecycleCtx> = {}): LifecycleCtx {
  return {
    ...BASE,
    audience: AUDIENCE[flow],
    tier: flow === "member" ? "team" : flow === "trial" ? "trial" : "free",
    daysSinceSignup: flow === "trial" ? 2 : 40,
    todayAnalysis: { ...BASE.todayAnalysis!, coverUrl: "https://cdn.test/covers/2026-09-22.png" },
    ...over,
    // The spotlight's body rides on the ctx, as the rail supplies it.
    ...({ spotlight: SPOTLIGHT } as Partial<LifecycleCtx>),
  };
}

describe("v2 structure", () => {
  for (const { flow, step, cid } of STEPS) {
    describe(`${flow}/${step}`, () => {
      const copy = DEFAULT_COPY[`${flow}/${step}`];
      const mail = renderLifecycle(flow, step, stepCtx(flow));

      it("exports a defaultCopy inside the §0.2 limits", () => {
        expect(copy, `${flow}/${step} has no defaultCopy`).toBeDefined();
        expect(copy.subject.length, copy.subject).toBeLessThanOrEqual(45);
        expect(copy.preheader.length, copy.preheader).toBeGreaterThan(0);
        expect(copy.preheader.length, copy.preheader).toBeLessThanOrEqual(90);
        expect(copy.ctaLabel.length, copy.ctaLabel).toBeLessThanOrEqual(28);
        expect(copy.ctaLabel).not.toMatch(/[→>]\s*$/);
        expect(copy.paragraphs.length).toBeLessThanOrEqual(3);
        // The digest's body IS the analysis card, so it carries no paragraphs.
        expect(copy.paragraphs.length).toBeGreaterThanOrEqual(step === "digest" ? 0 : 1);
        for (const para of copy.paragraphs) expect(para).not.toMatch(/<[a-z/]/i);
      });

      it("renders the copy's subject and hides its preheader in the shell", () => {
        // The digest's subject is a token template; spotlight's comes from the
        // brain. Every other step sends the approved subject verbatim.
        if (step !== "digest" && step !== "spotlight") {
          expect(mail.subject).toBe(copy.subject);
          expect(mail.subject.length).toBeLessThanOrEqual(45);
        }
        expect(mail.html).toContain(
          `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">`
        );
        expect(mail.html).toContain(escapeHtml(copy.preheader));
      });

      it("carries exactly one orange button, and attributes every link", () => {
        expect(mail.html.split(BUTTON_CELL)).toHaveLength(2);
        const links = hrefs(mail.html);
        expect(links.length).toBeGreaterThan(0);
        for (const href of links) {
          if (href.includes("/api/email/unsubscribe")) continue;
          expect(href, href).toContain("cid=EML-");
        }
        expect(mail.html).toContain(cid);
      });

      it("passes the compliance gate on both renderings", () => {
        expect(lintEmail(mail.subject).verdict).not.toBe("block");
        expect(lintEmail(mail.text).verdict).not.toBe("block");
        expect(lintEmail(emailLintText(mail.html)).verdict).not.toBe("block");
      });

      it("lets an approved variant replace the words", () => {
        const variant: LifecycleCopy = {
          subject: "A challenger subject",
          preheader: "A challenger preheader, ninety characters at the very most.",
          paragraphs: step === "digest" ? [] : ["A challenger paragraph about the desk."],
          ctaLabel: "Challenger label",
        };
        const swapped = renderLifecycle(flow, step, stepCtx(flow, { copy: variant }));
        if (step !== "digest" && step !== "spotlight") {
          expect(swapped.subject).toBe("A challenger subject");
        }
        expect(swapped.html).toContain("A challenger preheader");
        expect(swapped.text).toContain("Challenger label:");
        // digest has no paragraphs to swap; spotlight's body is the brain's,
        // and a variant is never allowed to overwrite approved editorial.
        if (step !== "digest" && step !== "spotlight") {
          expect(swapped.text).toContain("A challenger paragraph about the desk.");
          expect(swapped.text).not.toContain(copy.paragraphs[0]);
        }
      });
    });
  }

  it("gives every trial step the progress tracker", () => {
    for (const { flow, step } of STEPS.filter((s) => s.flow === "trial")) {
      const html = renderLifecycle(flow, step, stepCtx(flow)).html;
      expect(html, `${flow}/${step}`).toMatch(/(check|ring)@2x\.png/);
      expect(html, `${flow}/${step}`).toContain("YOUR FIRST 14 DAYS");
    }
  });

  it("gives the digest the cover, the bias badge and nothing else", () => {
    const html = renderLifecycle("nurture", "digest", stepCtx("nurture")).html;
    expect(html).toContain(`src="https://cdn.test/covers/2026-09-22.png"`);
    expect(html).toContain("BULLISH");
    expect(html).not.toContain("YOUR FIRST 14 DAYS");
  });

  it("drops the hero when the desk has published no cover", () => {
    const html = renderLifecycle(
      "nurture",
      "digest",
      stepCtx("nurture", { todayAnalysis: { ...BASE.todayAnalysis!, coverUrl: null } })
    ).html;
    expect(html).not.toContain("cdn.test/covers");
    // v2: the card headline is the description's first sentence; the dated
    // title only ever rides as the cover's alt text.
    expect(html).toContain("Price is pressing the range high into London.");
  });

  it("gives the two ladder emails the four-rung strip", () => {
    for (const [flow, step] of [
      ["trial", "ladder"],
      ["trial", "day12"],
      ["rescue", "upgrade-seen"],
    ] as const) {
      const text = renderLifecycle(flow, step, stepCtx(flow)).text;
      expect(text, `${flow}/${step}`).toContain("deposit into your own account");
      expect(text, `${flow}/${step}`).toContain("$500");
    }
  });

  it("gives each member email its feature tile", () => {
    const tiles: [string, string][] = [
      ["member-d3", "icon-ai-trading-assistant@2x.png"],
      ["member-d7", "icon-fundamental-desk@2x.png"],
      ["member-dormant", "icon-daily-analysis@2x.png"],
    ];
    for (const [step, icon] of tiles) {
      expect(renderLifecycle("member", step, stepCtx("member")).html, step).toContain(icon);
    }
  });

  it("labels the header with where the reader is", () => {
    expect(renderLifecycle("trial", "kys", stepCtx("trial")).html).toContain("DAY 03 / 14");
    expect(renderLifecycle("nurture", "digest", stepCtx("nurture")).html).toContain("DESK · XAU/USD");
    expect(renderLifecycle("member", "member-d7", stepCtx("member")).html).toContain("MEMBER");
  });

  it("covers all fourteen steps", () => {
    expect(STEPS).toHaveLength(14);
    expect(Object.keys(DEFAULT_COPY).sort()).toEqual(STEPS.map((s) => `${s.flow}/${s.step}`).sort());
  });
});
