import { describe, it, expect } from "vitest";
import { headerContent } from "./headerContent";

describe("headerContent", () => {
  it("trial_active: countdown title + soft CTA", () => {
    const c = headerContent("trial_active", 9);
    expect(c.title).toBe("9 days left in your trial");
    expect(c.cta).toEqual({
      href: "/upgrade",
      label: "Lock in your access anytime",
      kind: "soft",
    });
  });

  it("pluralizes the countdown (1 day vs 2 days)", () => {
    expect(headerContent("trial_active", 1).title).toBe(
      "1 day left in your trial"
    );
    expect(headerContent("re_trial_active", 2).title).toBe(
      "2 days left in your re-trial"
    );
  });

  it("re_trial_active: notes it is the last trial, soft CTA", () => {
    const c = headerContent("re_trial_active", 5);
    expect(c.body).toMatch(/last trial/i);
    expect(c.cta?.kind).toBe("soft");
  });

  it("member_active: calm confirmation and NEVER a CTA", () => {
    const c = headerContent("member_active", 0);
    expect(c.title).toBe("You're a funded member");
    expect(c.cta).toBeNull();
  });

  it("trial_expired: upgrade push", () => {
    const c = headerContent("trial_expired", 0);
    expect(c.title).toBe("Your trial's ended");
    expect(c.cta?.kind).toBe("push");
    expect(c.cta?.href).toBe("/upgrade");
  });

  it("an active status with 0 days left falls through to the expired copy", () => {
    // Lazy-expiry write hasn't landed yet; tier already gates as Limited —
    // the header must match the locked cards, not claim an active trial.
    expect(headerContent("trial_active", 0)).toEqual(
      headerContent("trial_expired", 0)
    );
    expect(headerContent("re_trial_active", 0)).toEqual(
      headerContent("re_trial_expired", 0)
    );
  });

  it("re_trial_expired: deposit-to-continue push, no re-trial framing", () => {
    const c = headerContent("re_trial_expired", 0);
    expect(c.title).toBe("Your access has ended — deposit to continue");
    expect(c.body).toMatch(/no further trials/i);
    expect(c.cta?.kind).toBe("push");
  });

  it("member_expired: membership-removed framing with push CTA", () => {
    const c = headerContent("member_expired", 0);
    expect(c.eyebrow).toBe("Membership ended");
    expect(c.cta?.kind).toBe("push");
  });
});
