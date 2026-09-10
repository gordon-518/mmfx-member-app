import { describe, it, expect } from "vitest";
import { summariseFunnel } from "./funnel";

describe("summariseFunnel", () => {
  it("renders a missing or malformed payload as zeros", () => {
    for (const raw of [null, undefined, "boom", 7, { funnel: "nope" }]) {
      const s = summariseFunnel(raw);
      expect(s.cohort).toBe(0);
      expect(s.activationPct).toBe(0);
      expect(s.days).toBe(30);
      expect(s.steps.map((x) => x.users)).toEqual([0, 0, 0, 0, 0]);
      expect(s.steps[0].pctOfPrev).toBeNull();
    }
  });

  it("computes activation, step-to-step rates and the conversion split", () => {
    const s = summariseFunnel({
      days: 30,
      cohort: 200,
      activated: 20,
      tv48: 34,
      da48: 61,
      activated_verified: 2,
      not_activated_verified: 1,
      funnel: {
        upgrade_viewed: 50,
        upgrade_broker_link_clicked: 20,
        upgrade_contact_clicked: 10,
        deposit_submitted: 5,
        deposit_verified: 2,
      },
    });
    expect(s.activationPct).toBe(10);
    expect(s.steps.map((x) => [x.users, x.pctOfPrev])).toEqual([
      [50, null],
      [20, 40],
      [10, 50],
      [5, 50],
      [2, 40],
    ]);
    expect(s.activatedConvPct).toBe(10); // 2 of 20
    expect(s.notActivatedConvPct).toBe(0.6); // 1 of 180
    expect(s.tv48).toBe(34);
    expect(s.da48).toBe(61);
  });

  it("keeps the canonical step order whatever order the DB returns", () => {
    const s = summariseFunnel({
      funnel: { deposit_verified: 1, upgrade_viewed: 9 },
    });
    expect(s.steps.map((x) => x.key)).toEqual([
      "upgrade_viewed",
      "upgrade_broker_link_clicked",
      "upgrade_contact_clicked",
      "deposit_submitted",
      "deposit_verified",
    ]);
    expect(s.steps[1].users).toBe(0);
  });

  it("coerces numeric strings and floors bad values to zero", () => {
    const s = summariseFunnel({ cohort: "40", activated: -3, funnel: { upgrade_viewed: "12" } });
    expect(s.cohort).toBe(40);
    expect(s.activated).toBe(0);
    expect(s.steps[0].users).toBe(12);
  });

  it("never divides by zero", () => {
    const s = summariseFunnel({ cohort: 0, activated: 0, funnel: { upgrade_viewed: 0 } });
    expect(s.activatedConvPct).toBe(0);
    expect(s.notActivatedConvPct).toBe(0);
    expect(s.steps[1].pctOfPrev).toBe(0);
  });
});
