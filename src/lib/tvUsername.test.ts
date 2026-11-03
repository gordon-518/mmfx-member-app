import { describe, it, expect } from "vitest";
import { tvErrorCodeFromDb, tvErrorMessage, validateTradingViewUsername } from "./tvUsername";
import { MESSAGES } from "@/i18n/messages";

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

describe("error codes", () => {
  it("names why a username was refused", () => {
    expect(validateTradingViewUsername("").code).toBe("empty");
    expect(validateTradingViewUsername("a@b.com").code).toBe("email");
    expect(validateTradingViewUsername("Mase M").code).toBe("spaces");
    expect(validateTradingViewUsername("no-va!").code).toBe("chars");
    expect(validateTradingViewUsername("novamase").code).toBeNull();
  });

  it("reads the database's refusals back as codes", () => {
    // The messages fn_set_tradingview_username raises (20260910000002).
    expect(tvErrorCodeFromDb("TradingView username cannot be empty")).toBe("empty");
    expect(tvErrorCodeFromDb("That looks like an email — enter your TradingView username (the @handle), not your email")).toBe("email");
    expect(tvErrorCodeFromDb("Enter your TradingView username (the @handle) — letters, numbers and underscores only, not your display name")).toBe("chars");
    expect(tvErrorCodeFromDb("No profile found for the current user")).toBe("generic");
  });

  it("shows a known code in the reader's language and anything else as generic", () => {
    expect(tvErrorMessage("email", MESSAGES["zh-Hans"].tv.errors)).toMatch(/邮箱/);
    expect(tvErrorMessage("<script>", MESSAGES.en.tv.errors)).toBe(MESSAGES.en.tv.errors.generic);
    expect(tvErrorMessage(null, MESSAGES.en.tv.errors)).toBeNull();
  });
});
