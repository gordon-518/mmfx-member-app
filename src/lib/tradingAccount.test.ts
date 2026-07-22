import { describe, it, expect } from "vitest";
import { validateTradingAccount } from "./tradingAccount";

describe("validateTradingAccount", () => {
  it("accepts 4-15 digit numbers", () => {
    expect(validateTradingAccount("5123").ok).toBe(true);
    expect(validateTradingAccount("51234567").ok).toBe(true);
    expect(validateTradingAccount("123456789012345").ok).toBe(true);
  });
  it("trims surrounding whitespace", () => {
    expect(validateTradingAccount("  51234567  ").ok).toBe(true);
  });
  it("rejects fewer than 4 digits", () => {
    expect(validateTradingAccount("123").ok).toBe(false);
  });
  it("rejects more than 15 digits", () => {
    expect(validateTradingAccount("1234567890123456").ok).toBe(false);
  });
  it("rejects non-digits", () => {
    expect(validateTradingAccount("51234abc").ok).toBe(false);
    expect(validateTradingAccount("5123-4567").ok).toBe(false);
  });
  it("rejects empty", () => {
    expect(validateTradingAccount("").ok).toBe(false);
    expect(validateTradingAccount("   ").ok).toBe(false);
  });
});
