import { describe, it, expect } from "vitest";
import { audienceFor } from "./audience";

const NOW = new Date("2026-06-24T12:00:00.000Z").getTime();
const future = new Date("2026-07-01T00:00:00.000Z").toISOString();
const past = new Date("2026-06-20T00:00:00.000Z").toISOString();

describe("audienceFor", () => {
  it("member_active → member", () => {
    expect(audienceFor("member_active", null, NOW)).toBe("member");
  });

  it("member_expired → removed (suspended)", () => {
    expect(audienceFor("member_expired", null, NOW)).toBe("removed");
  });

  it("active trial within the clock → trial", () => {
    expect(audienceFor("trial_active", future, NOW)).toBe("trial");
    expect(audienceFor("re_trial_active", future, NOW)).toBe("trial");
  });

  it("active trial whose clock has passed → expired (lazy-expiry aware)", () => {
    expect(audienceFor("trial_active", past, NOW)).toBe("expired");
    expect(audienceFor("re_trial_active", past, NOW)).toBe("expired");
    // exactly at the boundary counts as expired
    expect(audienceFor("trial_active", new Date(NOW).toISOString(), NOW)).toBe("expired");
  });

  it("explicitly expired statuses → expired", () => {
    expect(audienceFor("trial_expired", null, NOW)).toBe("expired");
    expect(audienceFor("re_trial_expired", null, NOW)).toBe("expired");
  });

  it("trial_active with no end date → trial (no clock to fail)", () => {
    expect(audienceFor("trial_active", null, NOW)).toBe("trial");
  });
});
