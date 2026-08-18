import { describe, it, expect } from "vitest";
import {
  computeMetrics,
  deltaPct,
  sgtDateString,
  parsePeriod,
  bucketFlowMetrics,
  bucketSnapshotSeries,
  type GrowthProfileRow,
  type SnapshotDatum,
} from "./metrics";

// A fixed "now": 2026-06-25 04:00 UTC = 2026-06-25 12:00 SGT (midday SGT).
const NOW = new Date("2026-06-25T04:00:00.000Z");

function row(overrides: Partial<GrowthProfileRow>): GrowthProfileRow {
  return {
    signup_at: null,
    account_status: "trial_expired",
    trial_ends_at: null,
    deposit_verified_at: null,
    downgraded_at: null,
    broker: null,
    tradingview_username: null,
    ...overrides,
  };
}

describe("sgtDateString", () => {
  it("rolls to the next calendar day past 16:00 UTC (SGT midnight)", () => {
    // 15:59 UTC is still 2026-06-25 in SGT; 16:00 UTC is 2026-06-26 in SGT.
    expect(sgtDateString(new Date("2026-06-25T15:59:00Z"))).toBe("2026-06-25");
    expect(sgtDateString(new Date("2026-06-25T16:00:00Z"))).toBe("2026-06-26");
  });
});

describe("deltaPct", () => {
  it("computes rounded percentage change", () => {
    expect(deltaPct(13, 10)).toBe(30);
    expect(deltaPct(8, 10)).toBe(-20);
  });
  it("returns null when prior is zero (no baseline)", () => {
    expect(deltaPct(5, 0)).toBeNull();
  });
});

describe("computeMetrics", () => {
  it("reports the SGT snapshot date", () => {
    expect(computeMetrics([], NOW).date).toBe("2026-06-25");
  });

  it("counts signups in SGT-today, 7d and 30d windows", () => {
    const rows = [
      // 09:00 SGT today (01:00 UTC) — counts in today/7d/30d
      row({ signup_at: "2026-06-25T01:00:00Z" }),
      // 23:00 UTC on the 24th = 07:00 SGT on the 25th — also SGT-today
      row({ signup_at: "2026-06-24T23:00:00Z" }),
      // 12:00 UTC on the 24th = 20:00 SGT on the 24th — NOT today, but in 7d/30d
      row({ signup_at: "2026-06-24T12:00:00Z" }),
      // 20 days ago — only in 30d
      row({ signup_at: "2026-06-05T04:00:00Z" }),
      // 40 days ago — in none
      row({ signup_at: "2026-05-16T04:00:00Z" }),
    ];
    const m = computeMetrics(rows, NOW);
    expect(m.signups_today).toBe(2);
    expect(m.signups_7d).toBe(3);
    expect(m.signups_30d).toBe(4);
  });

  it("counts active trials across trial_active and re_trial_active", () => {
    const rows = [
      row({ account_status: "trial_active", trial_ends_at: "2026-07-01T00:00:00Z" }),
      row({ account_status: "re_trial_active", trial_ends_at: "2026-07-01T00:00:00Z" }),
      row({ account_status: "trial_expired" }),
      row({ account_status: "member_active" }),
    ];
    expect(computeMetrics(rows, NOW).trials_active).toBe(2);
  });

  it("counts trials expiring within the next 48h, excluding already-expired", () => {
    const rows = [
      // expires in 24h — counts
      row({ account_status: "trial_active", trial_ends_at: "2026-06-26T04:00:00Z" }),
      // expires in exactly 48h — boundary, counts
      row({ account_status: "re_trial_active", trial_ends_at: "2026-06-27T04:00:00Z" }),
      // expires in 72h — outside window
      row({ account_status: "trial_active", trial_ends_at: "2026-06-28T04:00:00Z" }),
      // already expired (1h ago) — excluded
      row({ account_status: "trial_active", trial_ends_at: "2026-06-25T03:00:00Z" }),
      // active status but null clock — excluded
      row({ account_status: "trial_active", trial_ends_at: null }),
    ];
    expect(computeMetrics(rows, NOW).trials_expiring_48h).toBe(2);
  });

  it("counts conversions and churn only within SGT-today", () => {
    const rows = [
      row({ deposit_verified_at: "2026-06-25T02:00:00Z" }), // today
      row({ deposit_verified_at: "2026-06-24T12:00:00Z" }), // yesterday SGT
      row({ downgraded_at: "2026-06-25T03:30:00Z" }), // today
      row({ downgraded_at: "2026-06-20T04:00:00Z" }), // earlier
    ];
    const m = computeMetrics(rows, NOW);
    expect(m.conversions_today).toBe(1);
    expect(m.churn_today).toBe(1);
  });

  it("computes members, broker split and TV engagement among members only", () => {
    const rows = [
      row({ account_status: "member_active", broker: "octa", tradingview_username: "a" }),
      row({ account_status: "member_active", broker: "octa", tradingview_username: null }),
      row({ account_status: "member_active", broker: "dupoin", tradingview_username: "c" }),
      row({ account_status: "member_active", broker: "elev8", tradingview_username: "d" }),
      // not a member — must not affect split or engagement
      row({ account_status: "trial_active", broker: "octa", tradingview_username: "x" }),
    ];
    const m = computeMetrics(rows, NOW);
    expect(m.members_active).toBe(4);
    expect(m.broker_split).toEqual({ octa: 2, dupoin: 1, elev8: 1 });
    expect(m.tv_engagement_pct).toBe(75); // 3 of 4
  });

  it("reports 0% engagement with no members (no divide-by-zero)", () => {
    expect(computeMetrics([], NOW).tv_engagement_pct).toBe(0);
  });
});

// NOW = 2026-06-25 12:00 SGT, a Thursday. Its SGT week opens Mon 2026-06-22.

describe("parsePeriod", () => {
  it("accepts the four valid periods", () => {
    expect(parsePeriod("daily")).toBe("daily");
    expect(parsePeriod("weekly")).toBe("weekly");
    expect(parsePeriod("monthly")).toBe("monthly");
    expect(parsePeriod("yearly")).toBe("yearly");
  });
  it("defaults to daily for missing or unknown values", () => {
    expect(parsePeriod(undefined)).toBe("daily");
    expect(parsePeriod("")).toBe("daily");
    expect(parsePeriod("hourly")).toBe("daily");
  });
  it("reads the first entry of a repeated query param", () => {
    expect(parsePeriod(["weekly", "daily"])).toBe("weekly");
  });
});

describe("bucketFlowMetrics — daily", () => {
  it("returns 30 SGT-day buckets ending on today, oldest first", () => {
    const b = bucketFlowMetrics([], "daily", NOW);
    expect(b).toHaveLength(30);
    expect(b[29].key).toBe("2026-06-25");
    expect(b[29].label).toBe("25 Jun");
    expect(b[0].key).toBe("2026-05-27");
  });

  it("places signups/conversions/churn into the right SGT day, ignoring out-of-window", () => {
    const rows = [
      row({ signup_at: "2026-06-25T01:00:00Z" }), // 09:00 SGT today
      row({ signup_at: "2026-06-24T16:30:00Z" }), // 00:30 SGT 25th → still today
      row({ signup_at: "2026-06-24T12:00:00Z" }), // 20:00 SGT 24th → yesterday bucket
      row({ deposit_verified_at: "2026-06-25T02:00:00Z" }),
      row({ downgraded_at: "2026-06-25T03:00:00Z" }),
      row({ signup_at: "2026-05-01T00:00:00Z" }), // >30 days ago → dropped
    ];
    const b = bucketFlowMetrics(rows, "daily", NOW);
    expect(b[29].signups).toBe(2);
    expect(b[29].conversions).toBe(1);
    expect(b[29].churn).toBe(1);
    expect(b[28].signups).toBe(1); // 2026-06-24 bucket
    const total = b.reduce((s, x) => s + x.signups, 0);
    expect(total).toBe(3); // the 1-May signup is outside the 30-day window
  });
});

describe("bucketFlowMetrics — weekly", () => {
  it("returns 12 Mon–Sun weeks ending on the current SGT week", () => {
    const b = bucketFlowMetrics([], "weekly", NOW);
    expect(b).toHaveLength(12);
    expect(b[11].key).toBe("2026-06-22"); // Monday of NOW's week
    expect(b[10].key).toBe("2026-06-15");
    expect(b[0].key).toBe("2026-04-06");
  });

  it("groups signups by SGT week", () => {
    const rows = [
      row({ signup_at: "2026-06-22T02:00:00Z" }), // Mon current week
      row({ signup_at: "2026-06-25T01:00:00Z" }), // Thu current week
      row({ signup_at: "2026-06-16T02:00:00Z" }), // prior week
    ];
    const b = bucketFlowMetrics(rows, "weekly", NOW);
    expect(b[11].signups).toBe(2);
    expect(b[10].signups).toBe(1);
  });
});

describe("bucketFlowMetrics — monthly", () => {
  it("returns 12 SGT calendar months ending on the current month", () => {
    const b = bucketFlowMetrics([], "monthly", NOW);
    expect(b).toHaveLength(12);
    expect(b[11].key).toBe("2026-06");
    expect(b[11].label).toBe("Jun 2026");
    expect(b[10].key).toBe("2026-05");
    expect(b[0].key).toBe("2025-07");
  });

  it("groups signups by SGT month", () => {
    const rows = [
      row({ signup_at: "2026-06-10T00:00:00Z" }), // June
      row({ signup_at: "2026-05-20T00:00:00Z" }), // May
      row({ signup_at: "2026-05-31T16:30:00Z" }), // 00:30 SGT 1 Jun → June, not May
    ];
    const b = bucketFlowMetrics(rows, "monthly", NOW);
    expect(b[11].signups).toBe(2); // June: the 10th + the SGT-rollover one
    expect(b[10].signups).toBe(1); // May
  });
});

describe("bucketFlowMetrics — yearly", () => {
  it("spans every SGT year from the earliest data to now", () => {
    const rows = [
      row({ signup_at: "2024-03-01T00:00:00Z" }),
      row({ signup_at: "2026-06-25T01:00:00Z" }),
      row({ downgraded_at: "2025-09-01T00:00:00Z" }),
    ];
    const b = bucketFlowMetrics(rows, "yearly", NOW);
    expect(b.map((x) => x.key)).toEqual(["2024", "2025", "2026"]);
    expect(b[0].signups).toBe(1); // 2024
    expect(b[2].signups).toBe(1); // 2026
    expect(b[1].churn).toBe(1); // 2025
  });

  it("returns just the current year when there is no data", () => {
    const b = bucketFlowMetrics([], "yearly", NOW);
    expect(b.map((x) => x.key)).toEqual(["2026"]);
  });
});

describe("bucketSnapshotSeries", () => {
  it("emits one value per day bucket, chronological, dropping out-of-window", () => {
    const pts: SnapshotDatum[] = [
      { date: "2026-06-23", value: 5 },
      { date: "2026-06-24", value: 7 },
      { date: "2026-06-25", value: 9 },
      { date: "2026-01-01", value: 99 }, // outside the 30-day window
    ];
    expect(bucketSnapshotSeries(pts, "daily", NOW)).toEqual([5, 7, 9]);
  });

  it("keeps only the last snapshot within each bucket (weekly)", () => {
    const pts: SnapshotDatum[] = [
      { date: "2026-06-16", value: 4 }, // prior week
      { date: "2026-06-22", value: 10 }, // current week, earlier
      { date: "2026-06-25", value: 20 }, // current week, later → wins
    ];
    expect(bucketSnapshotSeries(pts, "weekly", NOW)).toEqual([4, 20]);
  });

  it("returns an empty series when no snapshots fall in the window", () => {
    expect(bucketSnapshotSeries([], "daily", NOW)).toEqual([]);
  });
});
