import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MessageText } from "./messageText";

const html = (text: string) => renderToStaticMarkup(<MessageText text={text} />);

describe("MessageText", () => {
  it("renders bold, italics, paragraphs and line breaks", () => {
    const out = html("Desk starts at **$200**.\n_Every top-up counts._\n\n1) Sign up\n2) Fund");
    expect(out).toContain("<strong");
    expect(out).toContain("$200</strong>");
    expect(out).toContain("<em>Every top-up counts.</em>");
    expect(out.match(/<p/g)).toHaveLength(2);
    expect(out).toContain("1) Sign up<br/>2) Fund");
  });

  it("opens app links in place and other links in a new tab, without the trailing full stop", () => {
    const out = html("Go to https://app.marketmakersfx.net/upgrade. Or https://t.me/mmfx_academy.");
    expect(out).toContain('href="/upgrade"');
    expect(out).toContain('href="https://t.me/mmfx_academy"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain("</a>.");
  });

  it("leaves handles with underscores alone", () => {
    const out = html("Message @MM_3000 or @MMFX_BOSS");
    expect(out).not.toContain("<em>");
    expect(out).toContain("@MM_3000 or @MMFX_BOSS");
  });

  it("never renders the message as HTML", () => {
    const out = html('<img src=x onerror="alert(1)"> **<b>hi</b>**');
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
    expect(out).not.toContain("<b>");
  });

  it("does not link a javascript: URL", () => {
    expect(html("javascript:alert(1)")).not.toContain("href");
  });
});
