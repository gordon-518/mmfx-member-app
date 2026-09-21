import { describe, expect, it } from "vitest";
import { COMPLIANCE_LINE, FLOWS, renderLifecycle, templateFor } from "./index";
import { url } from "./copy";
import welcome from "./templates/welcome";
import digest from "./templates/digest";
import type { LifecycleCtx } from "./types";

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

/** Every href in the HTML. */
function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
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
    expect(mail.subject).toBe("Welcome in — start with today's gold read");
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
    const links = hrefs(body.html);
    expect(links).toEqual(["https://app.marketmakersfx.net/daily-analysis?cid=EML-trial-welcome"]);
    expect(body.text).toContain("cid=EML-trial-welcome");
  });
});

describe("digest template", () => {
  const free = ctx({ audience: "expired", tier: "free", daysSinceSignup: 40 });

  it("leads with today's read and says what Free keeps", () => {
    const mail = renderLifecycle("nurture", "digest", free);
    expect(mail.subject).toBe("Gold today: Gold holds the 4H range high (bullish bias)");
    expect(mail.html).toContain("Bias: Bullish");
    expect(mail.text).toContain("Price is pressing the range high into London.");
    expect(mail.text).toContain("free account");
    expect(mail.text).toContain("Module 1 of the MM System course");
    assertCompliant(mail);
  });

  it("falls back to a generic headline with no analysis row", () => {
    const mail = renderLifecycle("nurture", "digest", ctx({ ...free, todayAnalysis: null }));
    expect(mail.subject).toBe("Gold today: Today's XAU/USD read");
    assertCompliant(mail);
  });

  it("carries one call to action, tagged with the digest cid", () => {
    expect(hrefs(digest(free).html)).toEqual([
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
