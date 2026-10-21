// Pure formatting + distance maths for the Fundamental Desk. No fetching, no
// React — so both the server views and the live-price client component share
// one set of rules, and the arithmetic is unit-tested.

import type { Analysis, Invalidation, SummaryInstrument } from "./types";
import { ASSET_CLASS_LABELS, deskInstrument } from "./types";

/**
 * Decimals a price level is quoted to. The desk's own dashboard prints
 * everything at 2dp, which flattens EUR/USD to "1.12" — useless when the
 * invalidation line is 30 pips away. Scale the precision to the magnitude
 * instead, which reproduces how each market is actually quoted.
 */
export function priceDecimals(value: number): number {
  const v = Math.abs(value);
  if (v >= 1000) return 2; // gold, BTC, ETH
  if (v >= 10) return 3; // yen crosses, silver
  return 4; // the rest of FX
}

/** A price level for display, or an em dash when the desk has none. */
export function formatLevel(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const d = priceDecimals(value);
  return value.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

/**
 * A gap between two prices, quoted at the instrument's own precision rather
 * than the gap's. Gold's 88.2 points away from the line is "88.20" — scaling
 * off the gap itself would print "88.200", which no gold quote ever shows.
 */
export function formatGap(gap: number, reference: number): string {
  const d = priceDecimals(reference);
  return gap.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

/** Confidence 0–1 → whole percent. */
export function confidencePct(confidence: number | null | undefined): number {
  if (confidence == null || !Number.isFinite(confidence)) return 0;
  return Math.round(Math.min(1, Math.max(0, confidence)) * 100);
}

/** Lit segments of a `total`-segment conviction bar. */
export function convictionSegments(
  confidence: number | null | undefined,
  total = 10
): number {
  if (confidence == null || !Number.isFinite(confidence)) return 0;
  return Math.round(Math.min(1, Math.max(0, confidence)) * total);
}

/**
 * The desk emits some fields as snake_case tokens
 * ("below_falling_h4_50_ema") and others as whole sentences, depending on
 * which model wrote the thesis. Normalize to readable prose either way.
 */
export function humanize(text: string | null | undefined): string {
  if (!text) return "—";
  const s = text.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "—";
  return s[0].toUpperCase() + s.slice(1);
}

/** "12m ago" / "3h 5m ago" — relative to `now` so it stays testable. */
export function formatAge(
  iso: string | null | undefined,
  now: number = Date.now()
): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const minutes = Math.max(0, Math.round((now - then) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
}

/** "21 Oct, 07:01 UTC" — the desk quotes every timestamp in UTC. */
export function formatUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return `${date}, ${time} UTC`;
}

export interface TheLine {
  level: number;
  /** The thesis holds while price stays on this side of `level`. */
  holds: "above" | "below";
}

/**
 * THE LINE — the hard level that falsifies the thesis. Matches the desk's own
 * pick: the "invalidate above" level first (so the headline number is the one
 * price must stay under), otherwise the "invalidate below" level. A thesis can
 * carry both; the second one still appears in the full contract.
 */
export function theLine(inv: Invalidation | null | undefined): TheLine | null {
  if (!inv) return null;
  if (inv.hard_level_invalidate_above != null) {
    return { level: inv.hard_level_invalidate_above, holds: "below" };
  }
  if (inv.hard_level_invalidate_below != null) {
    return { level: inv.hard_level_invalidate_below, holds: "above" };
  }
  return null;
}

export interface LineDistance {
  /** Absolute gap in the instrument's own units. */
  absolute: number;
  /** Gap as a percentage of the level. */
  pct: number;
  /** Where price sits relative to the level right now. */
  side: "above" | "below" | "at";
  /** True while price is still on the side the thesis needs. */
  intact: boolean;
}

/** Live distance from spot to THE LINE. */
export function distanceToLine(
  price: number | null | undefined,
  line: TheLine | null
): LineDistance | null {
  if (line == null || price == null || !Number.isFinite(price)) return null;
  if (!Number.isFinite(line.level) || line.level === 0) return null;
  const absolute = Math.abs(price - line.level);
  const side = price > line.level ? "above" : price < line.level ? "below" : "at";
  return {
    absolute,
    pct: (absolute / Math.abs(line.level)) * 100,
    side,
    // "at" counts as intact: the level has been reached, not broken, and the
    // desk's watcher is the authority on a confirmed break (5-min sustained
    // close) — we never pre-empt it with a STALE claim of our own.
    intact: side === "at" || side === line.holds,
  };
}

/** Is spot inside the thesis's watch zone? */
export function inWatchZone(
  price: number | null | undefined,
  zone: [number, number] | null | undefined
): boolean {
  if (price == null || !Number.isFinite(price) || !zone || zone.length !== 2) return false;
  const [low, high] = [Math.min(zone[0], zone[1]), Math.max(zone[0], zone[1])];
  return price >= low && price <= high;
}

/** "Holds while price stays below the H4 50 EMA" — one line, from the filter. */
export function trendFilterSentence(a: Analysis): string {
  const tf = a.invalidation.trend_filter;
  return `Holds while price stays ${tf.required_position} the ${tf.timeframe} ${tf.period} ${tf.indicator}`;
}

export interface AssetGroup {
  key: string;
  label: string;
  items: SummaryInstrument[];
}

/**
 * Summary rows bucketed into the grid's sections, in a fixed order. Rows for
 * instruments outside our registry are dropped: we can't name them or link to
 * them safely, and showing an untitled tile is worse than showing none.
 */
export function groupByAssetClass(rows: SummaryInstrument[]): AssetGroup[] {
  return ASSET_CLASS_LABELS.map(({ key, label }) => ({
    key,
    label,
    items: rows.filter((r) => deskInstrument(r.id)?.assetClass === key),
  })).filter((g) => g.items.length > 0);
}
