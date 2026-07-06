import { describe, it, expect } from "vitest";
import { isDemoUser, DEMO_EMAIL } from "./showcase";

describe("isDemoUser", () => {
  it("matches the demo email exactly", () => {
    expect(isDemoUser(DEMO_EMAIL)).toBe(true);
  });
  it("is case-insensitive", () => {
    expect(isDemoUser(DEMO_EMAIL.toUpperCase())).toBe(true);
  });
  it("rejects other emails", () => {
    expect(isDemoUser("real.member@gmail.com")).toBe(false);
  });
  it("rejects nullish", () => {
    expect(isDemoUser(null)).toBe(false);
    expect(isDemoUser(undefined)).toBe(false);
    expect(isDemoUser("")).toBe(false);
  });
});
