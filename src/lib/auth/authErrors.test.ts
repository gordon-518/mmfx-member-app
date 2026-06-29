import { describe, it, expect } from "vitest";
import { friendlyAuthError } from "./authErrors";

describe("friendlyAuthError", () => {
  it("maps invalid credentials without revealing which field", () => {
    expect(friendlyAuthError("Invalid login credentials")).toMatch(
      /email or password/i
    );
  });
  it("maps unconfirmed email to a verify hint", () => {
    expect(friendlyAuthError("Email not confirmed")).toMatch(/verify/i);
  });
  it("maps already-registered to a sign-in nudge", () => {
    expect(friendlyAuthError("User already registered")).toMatch(/already/i);
  });
  it("maps invalid/expired otp", () => {
    expect(friendlyAuthError("Token has expired or is invalid")).toMatch(/code/i);
  });
  it("falls back to a generic message", () => {
    expect(friendlyAuthError("some unknown thing")).toMatch(/try again/i);
  });
});
