import { describe, it, expect } from "vitest";
import { houseMarkdownToHtml } from "@/lib/channel/markdown";

describe("houseMarkdownToHtml", () => {
  it("converts bold, italic, and code", () => {
    expect(houseMarkdownToHtml("**hi** __x__ `c`")).toBe("<b>hi</b> <i>x</i> <code>c</code>");
  });
  it("escapes HTML-special chars before wrapping", () => {
    expect(houseMarkdownToHtml("a < b & **c**")).toBe("a &lt; b &amp; <b>c</b>");
  });
  it("leaves plain text untouched", () => {
    expect(houseMarkdownToHtml("just text")).toBe("just text");
  });
});
