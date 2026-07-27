import { describe, expect, it } from "vitest";
import { interventionEmailHtml } from "./interventionEmail";

describe("interventionEmailHtml", () => {
  it("includes the headline, action, CTA and unsubscribe links", () => {
    const html = interventionEmailHtml({
      headline: "This week's focus: Trading after losses",
      body: "18 trades after 2+ losses.",
      action: "Watch for this pattern.",
      ctaUrl: "https://app.marketmakersfx.net/journal",
      unsubUrl: "https://app.marketmakersfx.net/api/journal/email/unsubscribe?token=abc",
    });
    expect(html).toContain("This week's focus: Trading after losses");
    expect(html).toContain("Watch for this pattern.");
    expect(html).toContain("https://app.marketmakersfx.net/journal");
    expect(html).toContain("unsubscribe?token=abc");
    expect(html).toContain("<html");
  });

  it("escapes HTML in interpolated text", () => {
    const html = interventionEmailHtml({
      headline: "x",
      body: "<script>alert(1)</script>",
      action: "y",
      ctaUrl: "https://x",
      unsubUrl: "https://y",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
