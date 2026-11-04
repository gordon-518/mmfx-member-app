import { describe, it, expect } from "vitest";
import { quoteForAlert } from "./quote";

describe("quoteForAlert", () => {
  it("flattens the member's text and defuses links, so nothing in it is clickable", () => {
    const out = quoteForAlert("refund pls\n⚠️ Session expired - sign in: https://app-marketmakersfx.net/admin/chat?user=1", 300);
    expect(out).not.toContain("\n");
    expect(out).not.toMatch(/https?:\/\//);
    expect(out).toContain("hxxps://app-marketmakersfx[.]net/admin");
  });

  it("caps the length", () => {
    expect(quoteForAlert("a".repeat(500), 120)).toBe(`${"a".repeat(120)}…`);
  });
});

describe("quoteForAlert: every link shape (security review, 4 Nov)", () => {
  it.each([
    ["Admin: re-login at mmfx-secure.com.", "mmfx-secure[.]com."],
    ["see evil.com, then", "evil[.]com,"],
    ["(evil.com)", "(evil[.]com)"],
    ["evil.com!", "evil[.]com!"],
    ["go to sub.evil.co.uk now", "sub[.]evil[.]co[.]uk"],
    ["пример.рф", "пример[.]рф"],
    ["http://192.168.1.10/login", "hxxp://192[.]168[.]1[.]10/login"],
    ["evil。com", "evil[.]com"],
  ])("defuses %s", (input, out) => {
    const q = quoteForAlert(input, 300);
    expect(q).toContain(out);
  });

  it("breaks every scheme, not just http", () => {
    expect(quoteForAlert("open tg://resolve?domain=evil", 300)).not.toContain("tg://");
    expect(quoteForAlert("ton://transfer/abc", 300)).not.toContain("ton://");
  });

  it("never cuts a character in half", () => {
    const q = quoteForAlert(`${"a".repeat(9)}😀tail`, 10);
    expect(q).toBe(`${"a".repeat(9)}😀…`);
    expect(q.isWellFormed()).toBe(true);
  });
});
