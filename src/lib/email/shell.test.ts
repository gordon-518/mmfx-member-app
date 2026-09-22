import { describe, expect, it } from "vitest";
import { emailShell, escapeHtml, POSTAL_LINE } from "./shell";
import { EMAIL_ASSET_BASE } from "./ui";
import { interventionEmailHtml } from "@/lib/journal/interventionEmail";

// The shell was extracted OUT of interventionEmail.ts, and until v2 this file
// held a byte-identity test against the pre-extraction 480px frame. Shell v2
// replaces that frame on purpose — the v2 design (2026-09-22 §9) says the
// journal and deposit emails "get the shell v2 for free" while their copy is
// untouched — so the byte assertion is retired and what remains is the part
// that must not drift: the card's own contents, unchanged, inside the new
// frame.
const CARD = {
  headline: "This week's focus: Trading after losses",
  body: "18 trades after 2+ losses.",
  action: "Watch for this pattern.",
  ctaUrl: "https://app.marketmakersfx.net/journal",
  unsubUrl: "https://app.marketmakersfx.net/api/journal/email/unsubscribe?token=abc",
};

describe("interventionEmailHtml on shell v2", () => {
  const html = interventionEmailHtml(CARD);

  it("keeps the journal card's own markup byte-for-byte", () => {
    expect(html).toContain(
      `<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">This week's focus: Trading after losses</h1>`
    );
    expect(html).toContain(
      `<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#3a3a3a">18 trades after 2+ losses.</p>`
    );
    expect(html).toContain("<strong>Do this:</strong> Watch for this pattern.");
    expect(html).toContain(
      `<a href="https://app.marketmakersfx.net/journal" style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:12px">Open your AI Trading Assistant</a>`
    );
  });

  it("keeps its own consent line and unsubscribe link", () => {
    expect(html).toContain("You're getting this because you track your trading with Market Makers FX.");
    expect(html).toContain(`href="${CARD.unsubUrl}"`);
  });

  it("renders in the v2 frame without passing any of the new parameters", () => {
    expect(html).toContain('width="600"');
    expect(html).toContain("MARKET MAKERS FX");
    expect(html).toContain(POSTAL_LINE);
  });

  it("escapes the markup a coaching line can carry", () => {
    const evil = interventionEmailHtml({
      ...CARD,
      headline: `Quotes "and" <tags>`,
      body: "<script>alert(1)</script>",
      action: "A & B",
    });
    expect(evil).not.toContain("<script>");
    expect(evil).toContain("&lt;script&gt;");
    expect(evil).toContain("A &amp; B");
  });
});

describe("emailShell", () => {
  const base = { bodyHtml: `          <p>Hello</p>`, unsubUrl: "https://app.test/api/email/unsubscribe?token=tok" };

  it("frames the body, keeps the wordmark and links the unsubscribe URL", () => {
    const html = emailShell(base);
    expect(html).toContain("MARKET MAKERS FX");
    expect(html).toContain("<p>Hello</p>");
    expect(html).toContain(`href="https://app.test/api/email/unsubscribe?token=tok"`);
    expect(html).toContain("You're getting this because you have a Market Makers FX account.");
  });

  it("is a 600px card with the mark in a black header band", () => {
    const html = emailShell(base);
    expect(html).toContain('width="600"');
    expect(html).toContain("width:600px;max-width:100%");
    expect(html).toContain("background:#000000");
    expect(html).toContain(`${EMAIL_ASSET_BASE}/mark@2x.png`);
  });

  it("declares both colour schemes and links the brand fonts", () => {
    const html = emailShell(base);
    expect(html).toContain(`<meta name="color-scheme" content="light dark">`);
    expect(html).toContain(`<meta name="supported-color-schemes" content="light dark">`);
    expect(html).toContain("fonts.googleapis.com/css2?family=Montserrat");
    expect(html).toContain("Inter");
    expect(html).toContain("JetBrains+Mono");
  });

  it("closes with the postal line the CAN-SPAM footer needs", () => {
    expect(emailShell(base)).toContain("Market Makers FX, Singapore");
    expect(POSTAL_LINE).toBe("Market Makers FX, Singapore");
  });

  it("omits the context label unless one is given", () => {
    expect(emailShell(base)).not.toContain("DAY 03 / 14");
    const html = emailShell({ ...base, contextLabel: "DAY 03 / 14" });
    expect(html).toContain("DAY 03 / 14");
    expect(html).toContain('align="right"');
  });

  it("escapes a context label rather than trusting it", () => {
    expect(emailShell({ ...base, contextLabel: "<b>X</b>" })).toContain("&lt;b&gt;X&lt;/b&gt;");
  });

  it("renders no hero row by default", () => {
    const html = emailShell(base);
    expect(html).not.toContain("<img src=\"https://cdn.test");
    expect(html).not.toContain("mm-hero");
  });

  it("renders an image hero full-bleed under the header", () => {
    const html = emailShell({
      ...base,
      hero: { kind: "image", src: "https://cdn.test/cover.png", alt: "XAUUSD — 22 September" },
    });
    expect(html).toContain(`src="https://cdn.test/cover.png"`);
    expect(html).toContain(`alt="XAUUSD — 22 September"`);
    expect(html).toContain("display:block");
    expect(html).toContain('width="600"');
  });

  it("renders a display hero as a black block with a mono eyebrow", () => {
    const html = emailShell({
      ...base,
      hero: { kind: "display", eyebrow: "Welcome to the desk", headline: "READ THE MARKET.\nTHEN ACT ON IT." },
    });
    expect(html).toContain("Welcome to the desk");
    expect(html).toContain("READ THE MARKET.<br>THEN ACT ON IT.");
    expect(html).toContain("#FF5A1F");
    expect(html).toContain("Montserrat");
  });

  it("escapes a display hero's words", () => {
    const html = emailShell({
      ...base,
      hero: { kind: "display", eyebrow: "A & B", headline: "<b>X</b>" },
    });
    expect(html).toContain("A &amp; B");
    expect(html).toContain("&lt;b&gt;X&lt;/b&gt;");
    expect(html).not.toContain("<b>X</b>");
  });

  it("puts the risk line in the footer only when the caller has one", () => {
    expect(emailShell(base)).not.toContain("Trading involves risk");
    expect(emailShell({ ...base, riskLine: "Trading involves risk, and so on." })).toContain(
      "Trading involves risk, and so on."
    );
  });

  it("emits no preheader element when none is given", () => {
    const html = emailShell({ bodyHtml: "x", unsubUrl: "https://u" });
    expect(html).not.toContain("display:none");
  });

  it("hides the preheader in the body and escapes it", () => {
    const html = emailShell({
      bodyHtml: "x",
      unsubUrl: "https://u",
      preheader: `Today's <read> is up`,
    });
    expect(html).toContain("display:none");
    expect(html).toContain("is up");
    expect(html).not.toContain("<read>");
  });

  it("escapes the ampersands and angle brackets a body would break on", () => {
    expect(escapeHtml(`<a href="x">A & B</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;A &amp; B&lt;/a&gt;"
    );
  });
});
