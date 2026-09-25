import { describe, expect, it } from "vitest";
import { renderPartnerWeekly } from "./partnerWeekly";
import type { FunnelRow } from "@/lib/partners/funnel";

function row(p: Partial<FunnelRow>): FunnelRow {
  return {
    week: "2026-09-14",
    label: "Gold Hook 03",
    signups: 0,
    activated: 0,
    funded: 0,
    depositTotal: 0,
    firstTouchSignups: 0,
    firstTouchFunded: 0,
    ...p,
  };
}

const SINCE = new Date("2026-09-14T00:00:00Z");
const UNTIL = new Date("2026-09-21T00:00:00Z");

const ROWS = [
  row({ label: "Gold Hook 03", signups: 40, activated: 22, funded: 3, depositTotal: 1500 }),
  row({ label: "Quiet Ad", signups: 10, activated: 1, funded: 0, depositTotal: 0 }),
];

function render(rows: FunnelRow[] = ROWS) {
  return renderPartnerWeekly({ partnerName: "Ren", since: SINCE, until: UNTIL, rows });
}

describe("renderPartnerWeekly", () => {
  it("names the partner and the window in the subject", () => {
    const { subject } = render();
    expect(subject).toContain("Ren");
    expect(subject).toMatch(/14 Sept? to 21 Sept?/);
  });

  it("renders on the v2 shell", () => {
    const { html } = render();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("MARKET MAKERS FX");
    expect(html).toContain("PARTNER REPORT");
  });

  it("carries the five headline counts in both parts", () => {
    const { html, text } = render();
    for (const body of [html, text]) {
      expect(body).toContain("Signups");
      expect(body).toContain("50");
      expect(body).toContain("Funded");
      expect(body).toContain("$1,500");
      expect(body).toContain("6%");
    }
  });

  it("lists the ads, best-funded first", () => {
    const { text } = render();
    expect(text.indexOf("Gold Hook 03")).toBeLessThan(text.indexOf("Quiet Ad"));
    expect(text).toContain("Gold Hook 03 — 40 signups, 3 funded");
  });

  it("says plainly when a week was empty", () => {
    const { html, text } = render([]);
    expect(html).toContain("No tagged signups in this window.");
    expect(text).toContain("No tagged signups in this window.");
  });

  it("states the attribution rule rather than leaving it implied", () => {
    const { html, text } = render();
    for (const body of [html, text]) {
      expect(body).toContain("last paid touch within");
      expect(body).toContain("7 days of the deposit");
    }
  });

  it("carries no dashboard key — only the hash of one is ever stored", () => {
    const { html, text } = render();
    expect(html).not.toContain("?key=");
    expect(text).not.toContain("?key=");
  });

  it("stays calm: no exclamation marks anywhere", () => {
    // An email to an agency about money that sounds excited about itself is
    // an email nobody trusts.
    const { subject, html, text } = render();
    expect(subject).not.toContain("!");
    expect(text).not.toContain("!");
    // The shell's own markup has none either; a bang would be ours.
    expect(html.replace(/<!doctype html>/i, "")).not.toContain("!");
  });

  it("escapes an ad name rather than letting it write HTML", () => {
    const { html } = render([row({ label: '<b>pwn</b> "x"', signups: 1 })]);
    expect(html).toContain("&lt;b&gt;pwn&lt;/b&gt;");
    expect(html).not.toContain("<b>pwn</b>");
  });

  it("gives the reader a way to stop the report", () => {
    const { html } = render();
    expect(html).toContain("mailto:hello@marketmakersfx.net");
    expect(html).toContain("Unsubscribe");
  });
});
