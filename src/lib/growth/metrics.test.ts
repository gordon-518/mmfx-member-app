import { describe, it, expect } from "vitest";
import {
  computeMetrics,
  deltaPct,
  sgtDateString,
  type GrowthProfileRow,
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
