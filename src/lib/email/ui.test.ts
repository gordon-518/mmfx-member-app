import { describe, expect, it } from "vitest";
import {
  analysisCard,
  biasBadge,
  button,
  EMAIL_ASSET_BASE,
  featureCard,
  ladder,
  quote,
  tracker,
} from "./ui";

describe("ui", () => {
  it("biasBadge uses orange for bullish, gray for bearish, outlined ink for neutral", () => {
    expect(biasBadge("bullish").html).toContain("#FF5A1F");
    expect(biasBadge("bearish").html).toContain("#9CA3AF");
    expect(biasBadge("neutral").html).toContain("border:1px solid");
    expect(biasBadge("bullish").text).toBe("Bias: Bullish");
  });

  it("button is one orange table cell with the label and an arrow", () => {
    const b = button("https://app.test/x?cid=EML-a-b", "Open it");
    expect(b.html).toMatch(/background:#FF5A1F/);
    expect(b.html).toContain("Open it&nbsp;&rarr;");
    expect(b.html.match(/<a /g)).toHaveLength(1);
    expect(b.text).toBe("Open it: https://app.test/x?cid=EML-a-b");
  });

  it("button carries the Outlook VML fallback, pointing at the same href", () => {
    const b = button("https://app.test/x?cid=EML-a-b", "Open it");
    expect(b.html).toContain("<!--[if mso]>");
    expect(b.html).toContain("v:roundrect");
    // The <a> is hidden from Outlook so the two never render together.
    expect(b.html).toContain("<!--[if !mso]><!-->");
    expect([...b.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])).toEqual([
      "https://app.test/x?cid=EML-a-b",
      "https://app.test/x?cid=EML-a-b",
    ]);
  });

  it("tracker shows done steps as checks, the current step in ink, the rest muted", () => {
    const t = tracker({ tv: false, analysis: true, kys: false, lesson1: false, desk: false }, "kys");
    expect(t.html).toContain(`${EMAIL_ASSET_BASE}/check@2x.png`);
    expect((t.html.match(/ring@2x\.png/g) ?? []).length).toBe(4);
    expect(t.html).toContain("TODAY");
    expect(t.text).toContain("[x] Read today's Daily Analysis");
    expect(t.text).toContain("[ ] Know Your Style");
  });

  it("tracker marks every step done without claiming a current one", () => {
    const t = tracker({ tv: true, analysis: true, kys: true, lesson1: true, desk: true }, null);
    expect((t.html.match(/check@2x\.png/g) ?? []).length).toBe(5);
    expect(t.html).not.toContain("ring@2x.png");
    expect(t.html).not.toContain("TODAY");
  });

  it("tracker keeps the five steps in day order in both renderings", () => {
    const t = tracker({ tv: false, analysis: false, kys: false, lesson1: false, desk: false }, "analysis");
    expect(t.text.split("\n").slice(1)).toEqual([
      "[ ] Read today's Daily Analysis (day 1)",
      "[ ] Know Your Style — 3 minutes (day 2)",
      "[ ] Connect TradingView (day 4)",
      "[ ] Lesson 1 — Golden Mindset (day 6)",
      "[ ] See what each tier opens (day 9)",
    ]);
    expect(t.text.split("\n")[0]).toBe("Your first 14 days:");
  });

  it("featureCard and ladder render their icon and four rungs", () => {
    expect(
      featureCard("daily-analysis", "Daily Analysis", "The desk's read, every trading day.").html
    ).toContain("icon-daily-analysis@2x.png");
    const l = ladder();
    expect(l.text).toContain("Free");
    expect(l.text).toContain("$500");
    expect(l.html).not.toMatch(/fee/i);
  });

  it("ladder names every rung and says the money is a deposit, never a price", () => {
    const l = ladder();
    for (const rung of ["Free", "Foundation", "$50", "Desk", "$200", "Team MM", "$500"]) {
      expect(l.text).toContain(rung);
      expect(l.html).toContain(rung);
    }
    expect(l.text).toContain("deposit into your own account");
  });

  it("analysisCard carries the cover, the date, the bias and one button", () => {
    const c = analysisCard({
      title: "Gold holds the 4H range high",
      bias: "bullish",
      description: "Price is pressing the range high into London.",
      href: "https://app.test/daily-analysis?cid=EML-nurture-digest",
      ctaLabel: "Open today's analysis",
      dateLabel: "Tuesday · 22 Sep 2026",
    });
    expect(c.html).toContain("Gold holds the 4H range high");
    expect(c.html).toContain("Tuesday · 22 Sep 2026");
    expect(c.html).toContain("BULLISH");
    expect(c.html.match(/<a /g)).toHaveLength(1);
    expect(c.text).toContain("Bias: Bullish");
    expect(c.text).toContain("Open today's analysis: https://app.test/daily-analysis?cid=EML-nurture-digest");
  });

  it("analysisCard renders without a bias or a description", () => {
    const c = analysisCard({
      title: "Today's XAU/USD read",
      bias: null,
      description: null,
      href: "https://app.test/daily-analysis?cid=EML-nurture-digest",
      ctaLabel: "Read it",
    });
    expect(c.html).toContain("Today's XAU/USD read");
    expect(c.html).not.toContain("BULLISH");
    expect(c.text).not.toContain("Bias:");
  });

  it("escapes everything a desk headline can carry", () => {
    const c = analysisCard({
      title: '<b>XAU</b> & "the dollar"',
      bias: "neutral",
      description: null,
      href: "https://app.test/x?cid=EML-a-b",
      ctaLabel: "Open",
    });
    expect(c.html).not.toContain("<b>XAU</b>");
    expect(c.html).toContain("&lt;b&gt;XAU&lt;/b&gt; &amp; &quot;the dollar&quot;");
    expect(c.text).toContain('<b>XAU</b> & "the dollar"');
  });

  it("quote sets the Sifu line in display type against an orange rule", () => {
    const q = quote("You are not paid to be right. You are paid to be consistent.");
    expect(q.html).toContain("Montserrat");
    expect(q.html).toContain("#FF5A1F");
    expect(q.text).toBe("You are not paid to be right. You are paid to be consistent.");
  });

  it("every image is sized, alt-texted and block-displayed", () => {
    const html = [
      tracker({ tv: false, analysis: true, kys: false, lesson1: false, desk: false }, "kys").html,
      featureCard("signals", "Signals", "One line.").html,
      analysisCard({
        title: "T",
        bias: "bearish",
        description: null,
        href: "https://app.test/x?cid=EML-a-b",
        ctaLabel: "Open",
        coverUrl: "https://cdn.test/cover.png",
      }).html,
    ].join("");
    const imgs = html.match(/<img [^>]*>/g) ?? [];
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) {
      expect(img, img).toMatch(/\salt="/);
      expect(img, img).toMatch(/\swidth="/);
      expect(img, img).toMatch(/display:block/);
      expect(img, img).toMatch(/border:0/);
    }
  });

  it("points every asset at the versioned base", () => {
    expect(EMAIL_ASSET_BASE).toBe("https://marketmakersfx.net/email/v1");
    expect(featureCard("course", "The course", "x").html).toContain(
      `${EMAIL_ASSET_BASE}/icon-course@2x.png`
    );
  });
});
