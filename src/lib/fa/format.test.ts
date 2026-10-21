import { describe, it, expect } from "vitest";
import {
  confidencePct,
  convictionSegments,
  distanceToLine,
  formatAge,
  formatGap,
  formatLevel,
  formatUtc,
  groupByAssetClass,
  humanize,
  inWatchZone,
  priceDecimals,
  theLine,
} from "./format";
import type { Invalidation, SummaryInstrument } from "./types";

// Levels below are real values from the live desk API (2026-10-21).
describe("price precision", () => {
  it("scales decimals to how each market is quoted", () => {
    expect(priceDecimals(4141.7)).toBe(2); // gold
    expect(priceDecimals(83428.96)).toBe(2); // BTC
    expect(priceDecimals(158.186)).toBe(3); // yen
    expect(priceDecimals(57.495)).toBe(3); // silver
    expect(priceDecimals(1.1227)).toBe(4); // EUR/USD
    expect(priceDecimals(0.7016)).toBe(4); // AUD/USD
  });

  it("formats with thousands separators and keeps FX precision", () => {
    expect(formatLevel(4141.7)).toBe("4,141.70");
    expect(formatLevel(1.1227)).toBe("1.1227");
    expect(formatLevel(158.186)).toBe("158.186");
  });

  it("quotes a gap at the instrument's precision, not the gap's own", () => {
    expect(formatGap(88.2, 4220.4)).toBe("88.20"); // gold points, not "88.200"
    expect(formatGap(0.0074, 1.13)).toBe("0.0074"); // EUR pips
    expect(formatGap(0.814, 158.9)).toBe("0.814"); // yen
  });

  it("renders a missing level as an em dash, never as zero", () => {
    expect(formatLevel(null)).toBe("—");
    expect(formatLevel(undefined)).toBe("—");
    expect(formatLevel(Number.NaN)).toBe("—");
  });
});

describe("conviction", () => {
  it("renders confidence as whole percent", () => {
    expect(confidencePct(0.75)).toBe(75);
    expect(confidencePct(0.38)).toBe(38);
    expect(confidencePct(null)).toBe(0);
  });

  it("clamps out-of-contract confidence instead of overflowing the bar", () => {
    expect(convictionSegments(0.75)).toBe(8);
    expect(convictionSegments(0.42)).toBe(4);
    expect(convictionSegments(1.4)).toBe(10);
    expect(convictionSegments(-1)).toBe(0);
  });
});

describe("humanize", () => {
  it("turns the desk's snake_case tokens into prose", () => {
    expect(humanize("below_falling_h4_50_ema_and_both_daily_emas")).toBe(
      "Below falling h4 50 ema and both daily emas"
    );
    expect(humanize("2_consecutive_h4_closes")).toBe("2 consecutive h4 closes");
  });

  it("leaves a sentence alone apart from its first letter", () => {
    expect(humanize("price at 1.3372 is above the H4 50 EMA")).toBe(
      "Price at 1.3372 is above the H4 50 EMA"
    );
  });

  it("falls back to an em dash for empty input", () => {
    expect(humanize("")).toBe("—");
    expect(humanize(null)).toBe("—");
  });
});

describe("freshness", () => {
  const now = Date.parse("2026-10-21T10:00:00Z");

  it("reports minutes under the hour and h+m above it", () => {
    expect(formatAge("2026-10-21T09:48:00Z", now)).toBe("12m ago");
    expect(formatAge("2026-10-21T07:01:00Z", now)).toBe("2h 59m ago");
  });

  it("never reports a negative age from clock skew", () => {
    expect(formatAge("2026-10-21T10:05:00Z", now)).toBe("0m ago");
  });

  it("handles a missing or unparseable timestamp", () => {
    expect(formatAge(null, now)).toBe("—");
    expect(formatAge("not-a-date", now)).toBe("—");
    expect(formatUtc("not-a-date")).toBe("—");
  });

  it("prints timestamps in UTC, as the desk quotes them", () => {
    expect(formatUtc("2026-10-21T07:01:49.508036+00:00")).toBe("21 Oct, 07:01 UTC");
  });
});

function inv(partial: Partial<Invalidation>): Invalidation {
  return {
    trend_filter: {
      indicator: "EMA",
      period: 50,
      timeframe: "H4",
      required_position: "below",
      confirmation: "2_consecutive_h4_closes",
    },
    hard_level_invalidate_above: null,
    hard_level_invalidate_below: null,
    watch_zone: null,
    max_age_hours: 6,
    external_triggers: [],
    ...partial,
  };
}

describe("THE LINE", () => {
  it("takes the invalidate-above level first (gold's shape)", () => {
    expect(theLine(inv({ hard_level_invalidate_above: 4220.4 }))).toEqual({
      level: 4220.4,
      holds: "below",
    });
  });

  it("falls back to the invalidate-below level", () => {
    expect(theLine(inv({ hard_level_invalidate_below: 1.33 }))).toEqual({
      level: 1.33,
      holds: "above",
    });
  });

  it("prefers above when a thesis carries both (ETH's shape)", () => {
    const line = theLine(
      inv({ hard_level_invalidate_above: 2490.5, hard_level_invalidate_below: 2374 })
    );
    expect(line).toEqual({ level: 2490.5, holds: "below" });
  });

  it("returns null when the thesis has no hard level", () => {
    expect(theLine(inv({}))).toBeNull();
    expect(theLine(null)).toBeNull();
  });
});

describe("distance to THE LINE", () => {
  it("measures the gap in units and percent", () => {
    const d = distanceToLine(4141.7, { level: 4220.4, holds: "below" })!;
    expect(d.absolute).toBeCloseTo(78.7, 4);
    expect(d.pct).toBeCloseTo(1.8648, 3);
    expect(d.side).toBe("below");
    expect(d.intact).toBe(true);
  });

  it("flags price on the wrong side of the line", () => {
    const d = distanceToLine(4250, { level: 4220.4, holds: "below" })!;
    expect(d.side).toBe("above");
    expect(d.intact).toBe(false);
  });

  it("treats price exactly at the level as reached, not broken", () => {
    const d = distanceToLine(1.33, { level: 1.33, holds: "above" })!;
    expect(d.side).toBe("at");
    expect(d.pct).toBe(0);
    expect(d.intact).toBe(true);
  });

  it("is null without a price or a line", () => {
    expect(distanceToLine(null, { level: 1.1, holds: "below" })).toBeNull();
    expect(distanceToLine(4141.7, null)).toBeNull();
  });
});

describe("watch zone", () => {
  it("detects price inside the zone, inclusive of both edges", () => {
    expect(inWatchZone(4180, [4172, 4210])).toBe(true);
    expect(inWatchZone(4172, [4172, 4210])).toBe(true);
    expect(inWatchZone(4132.2, [4172, 4210])).toBe(false);
  });

  it("tolerates a reversed zone and a missing one", () => {
    expect(inWatchZone(4180, [4210, 4172])).toBe(true);
    expect(inWatchZone(4180, null)).toBe(false);
  });
});

describe("grid grouping", () => {
  const row = (id: string): SummaryInstrument => ({
    id,
    display: id,
    asset_class: "whatever",
    available: true,
    bias: "neutral",
    confidence: 0.5,
    state: "FRESH",
    generated_at: null,
  });

  it("buckets by our registry in a fixed order", () => {
    const groups = groupByAssetClass([row("BTCUSD"), row("EURUSD"), row("XAUUSD")]);
    expect(groups.map((g) => g.label)).toEqual(["Metals", "FX majors", "Crypto"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["XAUUSD"]);
  });

  it("drops instruments we cannot name or link to, and empty sections", () => {
    const groups = groupByAssetClass([row("XAUUSD"), row("DOGEUSD")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((i) => i.id)).toEqual(["XAUUSD"]);
  });
});
