import { describe, it, expect } from "vitest";
import { toTelegramHtml, stripMarkers } from "./format";

describe("toTelegramHtml", () => {
  it("converts the two markers", () => {
    expect(toTelegramHtml("**$50** and _maybe_")).toBe("<b>$50</b> and <i>maybe</i>");
  });

  it("escapes HTML before converting, so a member's angle bracket can't break the send", () => {
    expect(toTelegramHtml("5 < 10 & >20")).toBe("5 &lt; 10 &amp; &gt;20");
    expect(toTelegramHtml("<b>not mine</b>")).toBe("&lt;b&gt;not mine&lt;/b&gt;");
  });

  it("leaves snake_case handles and unpaired markers alone", () => {
    expect(toTelegramHtml("message @MM_3000 now")).toBe("message @MM_3000 now");
    expect(toTelegramHtml("a _b_c_ d")).toBe("a _b_c_ d");
    expect(toTelegramHtml("2 ** 3 is not bold")).toBe("2 ** 3 is not bold");
  });

  it("keeps links intact", () => {
    expect(toTelegramHtml("open https://app.marketmakersfx.net/upgrade now"))
      .toBe("open https://app.marketmakersfx.net/upgrade now");
  });

  it("handles multi-line replies", () => {
    expect(toTelegramHtml("**Steps**\n1) sign up\n2) top up **$50**"))
      .toBe("<b>Steps</b>\n1) sign up\n2) top up <b>$50</b>");
  });
});

describe("stripMarkers", () => {
  it("gives the plain text for length checks", () => {
    expect(stripMarkers("**$50** and _maybe_")).toBe("$50 and maybe");
  });
});
