import { describe, it, expect } from "vitest";
import { normalizeEnvelope, normalizeSummary } from "./parse";

// A trimmed copy of a real /api/analysis response (XAUUSD, 2026-10-21).
const LIVE_ENVELOPE = {
  schema_version: "1.0",
  state: "FRESH",
  state_reason: "all conditions within bounds",
  state_updated_at: "2026-10-21T09:41:44.836279+00:00",
  refresh_requested: false,
  analysis: {
    generated_at: "2026-10-21T07:01:49.508036+00:00",
    trigger: "scheduled",
    bias: "bearish",
    confidence: 0.75,
    dominant_driver: "oil_driven_inflation_forcing_fed_hawkish",
    regime_summary: "Real yields at 2.80%.",
    active_catalysts: [
      {
        name: "Brent crude at $110",
        narrative_pull: "bearish",
        actual_effect: "bearish",
        explanation: "Oil rebound feeds Fed pricing.",
      },
    ],
    narrative_summary: "Gold stays bearish.",
    price_context: {
      current: 4132.2,
      h4_50_ema: 4171.88,
      position_vs_trend: "below_falling_h4_50_ema",
    },
    invalidation: {
      trend_filter: {
        indicator: "EMA",
        period: 50,
        timeframe: "H4",
        required_position: "below",
        confirmation: "2_consecutive_h4_closes",
      },
      hard_level_invalidate_above: 4220.4,
      hard_level_invalidate_below: null,
      watch_zone: [4172.0, 4210.0],
      max_age_hours: 6,
      external_triggers: [
        { event: "Brent crude < $100", action: "invalidate", rationale: "removes the channel" },
      ],
    },
    data_gaps: ["fed_funds_futures unavailable"],
    confidence_drivers: ["Real yields and oil align bearish"],
  },
  reads: [
    {
      title: "Gold bears await $4,100 break",
      source: "FX Street",
      url: "https://www.fxstreet.com/news/gold-bears",
      sentiment: "bearish",
      date: "Tue, 20 Oct 2026 23:42:03 -0400",
    },
  ],
};

describe("normalizeEnvelope", () => {
  it("passes a real desk payload through intact", () => {
    const env = normalizeEnvelope(LIVE_ENVELOPE)!;
    expect(env.state).toBe("FRESH");
    expect(env.analysis.bias).toBe("bearish");
    expect(env.analysis.invalidation.hard_level_invalidate_above).toBe(4220.4);
    expect(env.analysis.invalidation.watch_zone).toEqual([4172, 4210]);
    expect(env.analysis.active_catalysts).toHaveLength(1);
    expect(env.reads).toHaveLength(1);
  });

  it("rejects a response with no thesis in it", () => {
    expect(normalizeEnvelope(null)).toBeNull();
    expect(normalizeEnvelope({ state: "FRESH" })).toBeNull();
    expect(normalizeEnvelope({ analysis: {} })).toBeNull();
  });

  it("rejects a thesis missing a bias, a price or an invalidation block", () => {
    const a = LIVE_ENVELOPE.analysis;
    expect(normalizeEnvelope({ ...LIVE_ENVELOPE, analysis: { ...a, bias: "sideways" } })).toBeNull();
    expect(normalizeEnvelope({ ...LIVE_ENVELOPE, analysis: { ...a, confidence: null } })).toBeNull();
    expect(
      normalizeEnvelope({ ...LIVE_ENVELOPE, analysis: { ...a, price_context: {} } })
    ).toBeNull();
    expect(
      normalizeEnvelope({ ...LIVE_ENVELOPE, analysis: { ...a, invalidation: null } })
    ).toBeNull();
  });

  it("survives drifted optional fields instead of throwing", () => {
    const env = normalizeEnvelope({
      ...LIVE_ENVELOPE,
      state: "ODD",
      reads: null,
      analysis: {
        ...LIVE_ENVELOPE.analysis,
        active_catalysts: null,
        data_gaps: [null, "", "real gap"],
        confidence_drivers: "not a list",
        invalidation: {
          ...LIVE_ENVELOPE.analysis.invalidation,
          watch_zone: [4172],
          external_triggers: [{ action: "watch" }],
          max_age_hours: null,
        },
      },
    })!;
    expect(env.state).toBe("WATCH"); // never defaults to FRESH
    expect(env.reads).toEqual([]);
    expect(env.analysis.active_catalysts).toEqual([]);
    expect(env.analysis.data_gaps).toEqual(["real gap"]);
    expect(env.analysis.confidence_drivers).toEqual([]);
    expect(env.analysis.invalidation.watch_zone).toBeNull();
    expect(env.analysis.invalidation.external_triggers).toEqual([]);
    expect(env.analysis.invalidation.max_age_hours).toBe(0);
  });

  it("drops a read whose URL isn't http(s)", () => {
    const env = normalizeEnvelope({
      ...LIVE_ENVELOPE,
      reads: [
        { title: "x", url: "javascript:alert(1)" },
        { title: "y", url: "https://example.com/ok" },
      ],
    })!;
    expect(env.reads.map((r) => r.url)).toEqual(["https://example.com/ok"]);
  });
});

describe("normalizeSummary", () => {
  it("reads the live shape", () => {
    const rows = normalizeSummary({
      instruments: [
        {
          id: "XAUUSD",
          display: "XAU/USD",
          asset_class: "metal",
          available: true,
          bias: "bearish",
          confidence: 0.75,
          state: "FRESH",
          generated_at: "2026-10-21T07:01:49.508036+00:00",
        },
      ],
    })!;
    expect(rows).toHaveLength(1);
    expect(rows[0].available).toBe(true);
    expect(rows[0].state).toBe("FRESH");
  });

  it("marks a row with no usable read as unavailable rather than neutral", () => {
    const rows = normalizeSummary({
      instruments: [{ id: "XAGUSD", available: true, bias: null, state: null }],
    })!;
    expect(rows[0]).toMatchObject({ available: false, bias: null, state: null });
    expect(rows[0].display).toBe("XAGUSD"); // falls back to the id
  });

  it("returns null when the response has no instruments array", () => {
    expect(normalizeSummary({})).toBeNull();
    expect(normalizeSummary(null)).toBeNull();
  });

  it("drops rows with no id", () => {
    expect(normalizeSummary({ instruments: [{ display: "???" }] })).toEqual([]);
  });
});
