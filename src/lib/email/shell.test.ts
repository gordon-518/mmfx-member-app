import { describe, expect, it } from "vitest";
import { emailShell, escapeHtml } from "./shell";
import { interventionEmailHtml } from "@/lib/journal/interventionEmail";

// The shell was extracted OUT of interventionEmail.ts. This is the pre-
// extraction implementation, copied verbatim, kept here as the proof that the
// refactor changed no byte of what the journal's coaching emails send. If a
// future shell change is meant to affect them too, this test should be updated
// deliberately — not deleted.
function legacyInterventionEmailHtml(p: {
  headline: string;
  body: string;
  action: string;
  ctaUrl: string;
  unsubUrl: string;
}): string {
  const esc = (s: string): string =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  return `<!doctype html>
<html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eceef1">
        <tr><td style="background:#0a0a0a;padding:18px 28px">
          <span style="color:#ff5a1f;font-weight:700;font-size:15px;letter-spacing:.3px">MARKET MAKERS FX</span>
        </td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${esc(p.headline)}</h1>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#3a3a3a">${esc(p.body)}</p>
          <div style="margin:0 0 22px;padding:14px 16px;background:#fff4ef;border-left:3px solid #ff5a1f;border-radius:8px;font-size:14px;line-height:1.5">
            <strong>Do this:</strong> ${esc(p.action)}
          </div>
          <a href="${esc(p.ctaUrl)}" style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:12px">Open your AI Trading Assistant</a>
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #eceef1;font-size:12px;color:#8a8f98">
          You're getting this because you track your trading with Market Makers FX.
          <a href="${esc(p.unsubUrl)}" style="color:#8a8f98">Unsubscribe</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const SAMPLES = [
  {
    headline: "This week's focus: Trading after losses",
    body: "18 trades after 2+ losses.",
    action: "Watch for this pattern.",
    ctaUrl: "https://app.marketmakersfx.net/journal",
    unsubUrl: "https://app.marketmakersfx.net/api/journal/email/unsubscribe?token=abc",
  },
  {
    headline: `Quotes "and" <tags>`,
    body: "<script>alert(1)</script>",
    action: "A & B",
    ctaUrl: "https://app.marketmakersfx.net/journal?a=1&b=2",
    unsubUrl: "https://x/y?token=t&z=1",
  },
];

describe("shell extraction", () => {
  it.each(SAMPLES)("leaves interventionEmailHtml byte-identical (%#)", (sample) => {
    expect(interventionEmailHtml(sample)).toBe(legacyInterventionEmailHtml(sample));
  });
});

describe("emailShell", () => {
  it("frames the body, keeps the wordmark and links the unsubscribe URL", () => {
    const html = emailShell({
      bodyHtml: `          <p>Hello</p>`,
      unsubUrl: "https://app.test/api/email/unsubscribe?token=tok",
    });
    expect(html).toContain("MARKET MAKERS FX");
    expect(html).toContain("<p>Hello</p>");
    expect(html).toContain(`href="https://app.test/api/email/unsubscribe?token=tok"`);
    expect(html).toContain("You're getting this because you have a Market Makers FX account.");
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
    expect(html).toContain("Today&#039;s &lt;read&gt; is up".replace("&#039;", "'"));
    expect(html).not.toContain("<read>");
  });

  it("escapes the ampersands and angle brackets a body would break on", () => {
    expect(escapeHtml(`<a href="x">A & B</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;A &amp; B&lt;/a&gt;"
    );
  });
});
