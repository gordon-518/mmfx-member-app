import { describe, it, expect } from "vitest";
import { ADMIN_TELEGRAM_URL, adminDmMessage, depositRef } from "./depositRef";

describe("depositRef", () => {
  it("is MM- plus the first 6 hex characters of the user id, uppercased", () => {
    expect(depositRef("3f9a2c1d-0000-4000-8000-000000000000")).toBe("MM-3F9A2C");
  });

  it("is stable for the same user", () => {
    const id = "abcdef12-3456-7890-abcd-ef1234567890";
    expect(depositRef(id)).toBe(depositRef(id));
  });

  it("puts the reference in the message and points at the admin account", () => {
    expect(adminDmMessage({ ref: "MM-ABC123" })).toContain("MM-ABC123");
    expect(ADMIN_TELEGRAM_URL).toBe("https://t.me/MM_3000");
  });

  it("carries the deposit's details, so the admin can check both ends", () => {
    expect(
      adminDmMessage({ ref: "MM-9DC9B2", amount: 370.28, broker: "octa", account: "63453820" })
    ).toBe(
      "Hi Amelia, I've just submitted my $370.28 deposit on the MMFX app. My broker octa, trading account 63453820. My reference is MM-9DC9B2."
    );
  });

  it("leaves out details it doesn't have", () => {
    expect(adminDmMessage({ ref: "MM-ABC123", amount: 60, account: "51234567" })).toBe(
      "Hi Amelia, I've just submitted my $60 deposit on the MMFX app. My trading account 51234567. My reference is MM-ABC123."
    );
  });

  it("includes the amount when it's known", () => {
    expect(adminDmMessage({ ref: "MM-ABC123", amount: 1250 })).toBe(
      "Hi Amelia, I've just submitted my $1,250 deposit on the MMFX app. My reference is MM-ABC123."
    );
  });
});
