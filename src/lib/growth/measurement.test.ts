import { describe, it, expect } from "vitest";
import { shapeMeasurement } from "./measurement";

describe("shapeMeasurement", () => {
  it("renders a missing or malformed payload as empty views", () => {
    for (const raw of [null, undefined, 7, "x", { tier_cohorts: "nope", weekly: {} }]) {
      const m = shapeMeasurement(raw);
      expect(m.tiers.map((t) => [t.tier, t.members])).toEqual([["foundation", 0], ["desk", 0], ["team", 0]]);
      expect(m.split.viewersPct).toBe(0);
      expect(m.trials.map((t) => [t.era, t.rate30Pct])).toEqual([["7-day", null], ["14-day", null]]);
      expect(m.weekly).toEqual([]);
    }
  });

  it("keeps the tier order and reads PostgREST numeric strings", () => {
    const m = shapeMeasurement({
      tier_cohorts: [
        { entry_tier: "team", members: 30, mature: 20, avg_cum90: "1240.50", median_cum90: "800.00" },
        { entry_tier: "foundation", members: 4, mature: 0, avg_cum90: null, median_cum90: null },
      ],
    });
    expect(m.tiers[0]).toEqual({ tier: "foundation", members: 4, mature: 0, avgCum90: null, medianCum90: null });
    expect(m.tiers[1].members).toBe(0);
    expect(m.tiers[2]).toEqual({ tier: "team", members: 30, mature: 20, avgCum90: 1240.5, medianCum90: 800 });
  });

  it("computes the Daily Analysis split rates", () => {
    const m = shapeMeasurement({
      analysis_split: { viewers: 40, viewers_converted: 2, others: 200, others_converted: 3 },
    });
    expect(m.split.viewersPct).toBe(5);
    expect(m.split.othersPct).toBe(1.5);
  });

  it("only gives a 30-day rate once a cohort has mature signups", () => {
    const m = shapeMeasurement({
      trial_cohorts: [
        { era: "7-day", signups: 3000, mature: 3000, converted30: 36, converted_so_far: 38 },
        { era: "14-day", signups: 400, mature: 0, converted30: 0, converted_so_far: 2 },
      ],
    });
    expect(m.trials[0].rate30Pct).toBe(1.2);
    expect(m.trials[1].rate30Pct).toBeNull();
    expect(m.trials[1].convertedSoFar).toBe(2);
  });

  it("turns weekly counts into rates", () => {
    const m = shapeMeasurement({ weekly: [{ week: "2026-09-08", signups: 80, tv48: 20, activated: 8 }] });
    expect(m.weekly).toEqual([{ week: "2026-09-08", signups: 80, tvPct: 25, activatedPct: 10 }]);
  });
});
