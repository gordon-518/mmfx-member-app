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
