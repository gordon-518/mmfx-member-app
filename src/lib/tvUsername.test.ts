import { describe, it, expect } from "vitest";
import { validateTradingViewUsername } from "./tvUsername";

describe("validateTradingViewUsername", () => {
  it("accepts a normal handle", () => {
    expect(validateTradingViewUsername("novamase").ok).toBe(true);
    expect(validateTradingViewUsername("AkaniR").ok).toBe(true);
    expect(validateTradingViewUsername("trader_01").ok).toBe(true);
  });
  it("trims surrounding whitespace", () => {
    expect(validateTradingViewUsername("  novamase  ").ok).toBe(true);
  });
  it("rejects an email with a helpful message", () => {
    const r = validateTradingViewUsername("novamase@gmail.com");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/email/i);
  });
  it("rejects a display name with spaces", () => {
    const r = validateTradingViewUsername("Mase M");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/space|display name/i);
  });
  it("rejects illegal characters", () => {
    expect(validateTradingViewUsername("no-va!mase").ok).toBe(false);
  });
  it("rejects empty", () => {
    expect(validateTradingViewUsername("").ok).toBe(false);
    expect(validateTradingViewUsername("   ").ok).toBe(false);
  });
});
