// The Fundamental Analysis Desk's public output contract (desk BUILD.md §6).
// Shapes verified against live /api/summary, /api/analysis and /api/price
// responses for all 11 instruments on 2026-10-21 — not inferred from the docs.
//
// Pure types + the instrument registry: safe to import from client components.

export type Bias = "bullish" | "bearish" | "neutral";
/** The watcher's freshness verdict (desk BUILD.md §9). */
export type DeskState = "FRESH" | "WATCH" | "STALE";
export type AssetClass = "metal" | "fx_major" | "crypto";

/** One row of /api/summary — everything a grid tile needs, in one call. */
export interface SummaryInstrument {
  id: string;
  display: string;
  asset_class: string;
  available: boolean;
  bias: Bias | null;
  confidence: number | null;
  state: DeskState | null;
  generated_at: string | null;
}

export interface Catalyst {
  name: string;
  /** What the narrative says the catalyst should do. */
  narrative_pull: string;
  /** What it is actually doing to price — the two often disagree. */
  actual_effect: string;
  explanation: string;
}

export interface TrendFilter {
  indicator: string;
  period: number;
  timeframe: string;
  required_position: string;
  confirmation: string;
}

export interface ExternalTrigger {
  event: string;
  /** "invalidate" kills the thesis; "watch" only raises attention. */
  action: string;
  rationale: string;
}

export interface Invalidation {
  trend_filter: TrendFilter;
  /** At most one of the two hard levels is null; some theses carry both. */
  hard_level_invalidate_above: number | null;
  hard_level_invalidate_below: number | null;
  /** [low, high] — price inside it means the thesis is under pressure. */
  watch_zone: [number, number] | null;
  max_age_hours: number;
  external_triggers: ExternalTrigger[];
}

export interface PriceContext {
  current: number;
  h4_50_ema: number;
  /** Sometimes a snake_case token, sometimes a full sentence — humanize it. */
  position_vs_trend: string;
}

export interface Analysis {
  generated_at: string;
  trigger: string;
  bias: Bias;
  /** 0–1. */
  confidence: number;
  dominant_driver: string;
  regime_summary: string;
  active_catalysts: Catalyst[];
  narrative_summary: string;
  price_context: PriceContext;
  invalidation: Invalidation;
  data_gaps: string[];
  confidence_drivers: string[];
}

/** An article the desk read at synthesis time (frozen onto the thesis). */
export interface Read {
  title: string;
  source: string;
  url: string;
  sentiment: string;
  date: string;
}

/** The /api/analysis envelope: the cached thesis plus its live freshness. */
export interface AnalysisEnvelope {
  schema_version: string;
  state: DeskState;
  state_reason: string;
  state_updated_at: string;
  refresh_requested: boolean;
  analysis: Analysis;
  /** Empty for crypto — the news source has no crypto coverage. */
  reads: Read[];
}

export interface PriceQuote {
  price: number;
  symbol: string;
}

/** A desk instrument. `nickname` is the desk's own label for the asset. */
export interface DeskInstrument {
  id: string;
  display: string;
  nickname: string;
  assetClass: AssetClass;
}

// The desk's fixed registry of 11 instruments (desk BUILD.md §2). This is the
// allowlist: the desk's own /api/analysis and /api/price silently fall back to
// gold for an unknown ?instrument=, so an unvalidated param would render gold
// data under someone else's name. Everything that reaches the desk is checked
// against this map first.
export const FA_INSTRUMENTS: DeskInstrument[] = [
  { id: "XAUUSD", display: "XAU/USD", nickname: "Gold", assetClass: "metal" },
  { id: "XAGUSD", display: "XAG/USD", nickname: "Silver", assetClass: "metal" },
  { id: "EURUSD", display: "EUR/USD", nickname: "Euro", assetClass: "fx_major" },
  { id: "GBPUSD", display: "GBP/USD", nickname: "Sterling", assetClass: "fx_major" },
  { id: "USDJPY", display: "USD/JPY", nickname: "Yen", assetClass: "fx_major" },
  { id: "USDCHF", display: "USD/CHF", nickname: "Franc", assetClass: "fx_major" },
  { id: "AUDUSD", display: "AUD/USD", nickname: "Aussie", assetClass: "fx_major" },
  { id: "USDCAD", display: "USD/CAD", nickname: "Loonie", assetClass: "fx_major" },
  { id: "NZDUSD", display: "NZD/USD", nickname: "Kiwi", assetClass: "fx_major" },
  { id: "BTCUSD", display: "BTC/USD", nickname: "Bitcoin", assetClass: "crypto" },
  { id: "ETHUSD", display: "ETH/USD", nickname: "Ethereum", assetClass: "crypto" },
];

const BY_ID = new Map(FA_INSTRUMENTS.map((i) => [i.id, i]));

/** The registry entry for an id, or null when it isn't a desk instrument. */
export function deskInstrument(id: string | undefined | null): DeskInstrument | null {
  return (id && BY_ID.get(id)) || null;
}

/** Grid section order + headings. */
export const ASSET_CLASS_LABELS: { key: AssetClass; label: string }[] = [
  { key: "metal", label: "Metals" },
  { key: "fx_major", label: "FX majors" },
  { key: "crypto", label: "Crypto" },
];
