import { describe, it, expect } from "vitest";
import { validatePassword } from "./password";

describe("validatePassword", () => {
  it("rejects shorter than 8 chars", () => {
    expect(validatePassword("a1b2c3d").ok).toBe(false);
  });
  it("rejects all-letters (no number)", () => {
    expect(validatePassword("abcdefgh").ok).toBe(false);
  });
  it("rejects all-numbers (no letter)", () => {
    expect(validatePassword("12345678").ok).toBe(false);
  });
  it("accepts 8+ chars with a letter and a number", () => {
    expect(validatePassword("trade2026").ok).toBe(true);
  });
  it("returns a human message when invalid", () => {
    expect(validatePassword("short").message).toMatch(/8/);
  });
});
