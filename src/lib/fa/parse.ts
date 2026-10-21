// Tolerant normalizer for the desk's /api/analysis envelope.
//
// The desk is a separate service on its own release cycle, so the payload can
// drift under us. The views index into its arrays and read nested numbers, and
// a member page must not 500 because one optional list arrived as null. Hand
// rolled rather than a zod schema on purpose: the goal is to render what we
// did get (with the missing parts honestly blank), not to reject a whole
// thesis over one drifted field. Only the load-bearing core — a bias, a
// confidence, a current price and an invalidation block — is mandatory; the
// view has nothing to say without it, and returning null renders the "no
// thesis" panel instead.

import type {
  Analysis,
  AnalysisEnvelope,
  Bias,
  Catalyst,
  DeskState,
  ExternalTrigger,
  Invalidation,
  Read,
  SummaryInstrument,
  TrendFilter,
} from "./types";

type Obj = Record<string, unknown>;

function obj(value: unknown): Obj | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : null;
}
function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function bias(value: unknown): Bias | null {
  return value === "bullish" || value === "bearish" || value === "neutral" ? value : null;
}
function state(value: unknown): DeskState | null {
  return value === "FRESH" || value === "WATCH" || value === "STALE" ? value : null;
}

function trendFilter(value: unknown): TrendFilter {
  const t = obj(value) ?? {};
  return {
    indicator: str(t.indicator, "EMA"),
    period: num(t.period) ?? 0,
    timeframe: str(t.timeframe),
    required_position: str(t.required_position),
    confirmation: str(t.confirmation),
  };
}

/** A watch zone is only usable as a [low, high] pair of real numbers. */
function watchZone(value: unknown): [number, number] | null {
  const z = arr(value);
  if (z.length !== 2) return null;
  const a = num(z[0]);
  const b = num(z[1]);
  return a != null && b != null ? [a, b] : null;
}

function invalidation(value: unknown): Invalidation | null {
  const i = obj(value);
  if (!i) return null;
  return {
    trend_filter: trendFilter(i.trend_filter),
    hard_level_invalidate_above: num(i.hard_level_invalidate_above),
    hard_level_invalidate_below: num(i.hard_level_invalidate_below),
    watch_zone: watchZone(i.watch_zone),
    max_age_hours: num(i.max_age_hours) ?? 0,
    external_triggers: arr(i.external_triggers)
      .map((t): ExternalTrigger | null => {
        const e = obj(t);
        if (!e || !str(e.event)) return null;
        return {
          event: str(e.event),
          action: str(e.action, "watch"),
          rationale: str(e.rationale),
        };
      })
      .filter((t): t is ExternalTrigger => t !== null),
  };
}

function catalysts(value: unknown): Catalyst[] {
  return arr(value)
    .map((c): Catalyst | null => {
      const o = obj(c);
      if (!o || !str(o.name)) return null;
      return {
        name: str(o.name),
        narrative_pull: str(o.narrative_pull, "neutral"),
        actual_effect: str(o.actual_effect, "neutral"),
        explanation: str(o.explanation),
      };
    })
    .filter((c): c is Catalyst => c !== null);
}

function reads(value: unknown): Read[] {
  return arr(value)
    .map((r): Read | null => {
      const o = obj(r);
      const url = str(o?.url);
      // Links are rendered as anchors a member clicks: http(s) only, no
      // javascript:/data: URL smuggled in from upstream.
      if (!o || !/^https?:\/\//i.test(url)) return null;
      return {
        url,
        title: str(o.title, url),
        source: str(o.source),
        sentiment: str(o.sentiment),
        date: str(o.date),
      };
    })
    .filter((r): r is Read => r !== null);
}

function strings(value: unknown): string[] {
  return arr(value).filter((s): s is string => typeof s === "string" && s.trim() !== "");
}

/**
 * Summary rows, keeping only entries with an id. A row whose bias, confidence
 * or state didn't come through is kept but marked unavailable: the grid then
 * shows the instrument as "no thesis yet" rather than inventing a neutral read.
 */
export function normalizeSummary(raw: unknown): SummaryInstrument[] | null {
  const root = obj(raw);
  if (!root || !Array.isArray(root.instruments)) return null;
  return root.instruments
    .map((r): SummaryInstrument | null => {
      const o = obj(r);
      const id = str(o?.id);
      if (!o || !id) return null;
      const b = bias(o.bias);
      const confidence = num(o.confidence);
      const s = state(o.state);
      return {
        id,
        display: str(o.display, id),
        asset_class: str(o.asset_class),
        available: o.available === true && b != null && s != null,
        bias: b,
        confidence,
        state: s,
        generated_at: typeof o.generated_at === "string" ? o.generated_at : null,
      };
    })
    .filter((r): r is SummaryInstrument => r !== null);
}

/** The envelope, or null when there is no renderable thesis in it. */
export function normalizeEnvelope(raw: unknown): AnalysisEnvelope | null {
  const env = obj(raw);
  const a = obj(env?.analysis);
  if (!env || !a) return null;

  const b = bias(a.bias);
  const confidence = num(a.confidence);
  const pc = obj(a.price_context);
  const current = num(pc?.current);
  const inv = invalidation(a.invalidation);
  if (b == null || confidence == null || current == null || inv == null) return null;

  const analysis: Analysis = {
    generated_at: str(a.generated_at),
    trigger: str(a.trigger),
    bias: b,
    confidence,
    dominant_driver: str(a.dominant_driver),
    regime_summary: str(a.regime_summary),
    active_catalysts: catalysts(a.active_catalysts),
    narrative_summary: str(a.narrative_summary),
    price_context: {
      current,
      h4_50_ema: num(pc?.h4_50_ema) ?? 0,
      position_vs_trend: str(pc?.position_vs_trend),
    },
    invalidation: inv,
    data_gaps: strings(a.data_gaps),
    confidence_drivers: strings(a.confidence_drivers),
  };

  return {
    schema_version: str(env.schema_version),
    // The desk's own state is authoritative; absent one, WATCH is the honest
    // default — never FRESH, which would overstate what we know.
    state: state(env.state) ?? "WATCH",
    state_reason: str(env.state_reason),
    state_updated_at: str(env.state_updated_at),
    refresh_requested: env.refresh_requested === true,
    analysis,
    reads: reads(env.reads),
  };
}
