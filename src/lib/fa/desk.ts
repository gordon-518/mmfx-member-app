import "server-only";

// Server-side reader for the Fundamental Analysis Desk's public API (desk
// BUILD.md §10). Every endpoint is unauthenticated and fast (~50–120ms), but
// it stays server-side: the browser never learns the desk's hostname, and one
// cached fetch serves every member who opens the page inside the window.
//
// Each reader returns null rather than throwing, so a desk outage renders an
// honest "the desk is unreachable" panel instead of a 500 on a member page.

import type { AnalysisEnvelope, PriceQuote, SummaryInstrument } from "./types";
import { deskInstrument } from "./types";
import { normalizeEnvelope, normalizeSummary } from "./parse";

export const DESK_ORIGIN = "https://api.marketmakersfx.net";

// 60s: the desk's watcher re-evaluates freshness every 30s and theses are
// written at most once per 15 minutes per instrument, so a minute-old read is
// never materially behind. Live spot is polled separately and uncached.
const REVALIDATE_SECONDS = 60;
const TIMEOUT_MS = 8_000;

async function readJson<T>(
  path: string,
  init: RequestInit & { next?: { revalidate: number } }
): Promise<T | null> {
  try {
    const res = await fetch(`${DESK_ORIGIN}${path}`, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Unreachable, timed out, or not JSON — the caller renders the outage state.
    return null;
  }
}

/** Every instrument's {bias, confidence, state} in one call — the grid. */
export async function getDeskSummary(): Promise<SummaryInstrument[] | null> {
  const json = await readJson<unknown>("/api/summary", {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  return normalizeSummary(json);
}

/**
 * The full cached thesis for one instrument, normalized. Returns null when the
 * desk is unreachable, when it answers without a thesis (none synthesized for
 * that instrument yet), or when the payload has drifted past what we can
 * render — all three render the same honest "no thesis" panel.
 */
export async function getDeskAnalysis(
  instrumentId: string
): Promise<AnalysisEnvelope | null> {
  // The desk falls back to gold for an unknown ?instrument=, so an id that
  // isn't ours must never reach it.
  if (!deskInstrument(instrumentId)) return null;
  const json = await readJson<unknown>(
    `/api/analysis?instrument=${encodeURIComponent(instrumentId)}`,
    { next: { revalidate: REVALIDATE_SECONDS } }
  );
  return normalizeEnvelope(json);
}

/** Live spot. Never cached — it is the one number that must be current. */
export async function getDeskPrice(
  instrumentId: string
): Promise<PriceQuote | null> {
  if (!deskInstrument(instrumentId)) return null;
  const json = await readJson<PriceQuote>(
    `/api/price?instrument=${encodeURIComponent(instrumentId)}`,
    { cache: "no-store" }
  );
  if (!json || typeof json.price !== "number" || !Number.isFinite(json.price)) {
    return null;
  }
  return { price: json.price, symbol: typeof json.symbol === "string" ? json.symbol : "" };
}

/** The desk's branded PDF for one instrument (public endpoint). */
export function deskReportUrl(instrumentId: string): string {
  return `${DESK_ORIGIN}/api/report.pdf?instrument=${encodeURIComponent(instrumentId)}`;
}
