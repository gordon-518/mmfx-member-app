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
    expect(adminDmMessage("MM-ABC123")).toContain("MM-ABC123");
    expect(ADMIN_TELEGRAM_URL).toBe("https://t.me/MM_3000");
  });

  it("includes the amount when it's known", () => {
    expect(adminDmMessage("MM-ABC123", 1250)).toBe(
      "Hi Amelia, I've just submitted my $1,250 deposit on the MMFX app. My reference is MM-ABC123."
    );
  });
});
