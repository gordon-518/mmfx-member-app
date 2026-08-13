// Deal → trade reconstruction — pure, side-effect-free, unit-tested.
//
// MT5 reports executions as "deals". A position's lifecycle is a sequence of
// deals sharing a positionId: entries (DEAL_ENTRY_IN), exits (DEAL_ENTRY_OUT /
// DEAL_ENTRY_OUT_BY) and reversals (DEAL_ENTRY_INOUT). This module folds a
// deal list into round-trip trades plus deposit/withdrawal cash flows.
//
// Semantics (see reconstruct.test.ts for the executable spec):
// - Direction comes from the first entry deal's type; when the entry fell
//   outside the fetched history, it is inferred as the opposite of the exits.
// - Prices are volume-weighted averages per side.
// - A position stays "open" while exited volume < entered volume; its profit
//   fields reflect the realized legs so far.
// - DEAL_ENTRY_INOUT (netting reversal) is treated as closing the position —
//   the reversal remainder is a Phase-2 refinement, noted in the spec.
// - DEAL_TYPE_BALANCE deals become cash flows; other non-trade types ignored.

import type {
  CashFlow,
  MetaApiDeal,
  ReconstructedTrade,
  ReconstructionResult,
} from "./types";

const TRADE_TYPES = new Set(["DEAL_TYPE_BUY", "DEAL_TYPE_SELL"]);
const ENTRY_TYPES = new Set(["DEAL_ENTRY_IN"]);
const EXIT_TYPES = new Set([
  "DEAL_ENTRY_OUT",
  "DEAL_ENTRY_OUT_BY",
  "DEAL_ENTRY_INOUT",
]);
const VOLUME_EPSILON = 1e-9;

/** Stable ordering: by time, then by numeric-aware deal id. */
function compareDeals(a: MetaApiDeal, b: MetaApiDeal): number {
  const t = new Date(a.time).getTime() - new Date(b.time).getTime();
  if (t !== 0) return t;
  const an = Number(a.id);
  const bn = Number(b.id);
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function vwap(legs: { volume: number; price: number }[]): number | null {
  let volume = 0;
  let notional = 0;
  for (const leg of legs) {
    volume += leg.volume;
    notional += leg.volume * leg.price;
  }
  return volume > VOLUME_EPSILON ? notional / volume : null;
}

function buildTrade(positionDeals: MetaApiDeal[]): ReconstructedTrade | null {
  const entries = positionDeals.filter((d) =>
    ENTRY_TYPES.has(d.entryType ?? "")
  );
  const exits = positionDeals.filter((d) => EXIT_TYPES.has(d.entryType ?? ""));
  if (entries.length === 0 && exits.length === 0) return null;

  // Direction: first entry's type, else the opposite of the first exit's type
  // (closing a buy position executes a SELL deal, and vice versa).
  const first = entries[0] ?? exits[0];
  const direction: "buy" | "sell" =
    entries.length > 0
      ? first.type === "DEAL_TYPE_BUY"
        ? "buy"
        : "sell"
      : first.type === "DEAL_TYPE_BUY"
        ? "sell"
        : "buy";

  const enteredVolume = entries.reduce((s, d) => s + (d.volume ?? 0), 0);
  const exitedVolume = exits.reduce((s, d) => s + (d.volume ?? 0), 0);

  // INOUT closes the whole position regardless of leg volumes; a bare-exit
  // history (entry outside our window) is also considered closed.
  const closed =
    entries.length === 0 ||
    exits.some((d) => d.entryType === "DEAL_ENTRY_INOUT") ||
    exitedVolume >= enteredVolume - VOLUME_EPSILON;

  const priceLegs = (deals: MetaApiDeal[]) =>
    deals
      .filter((d) => (d.volume ?? 0) > VOLUME_EPSILON && d.price != null)
      .map((d) => ({ volume: d.volume as number, price: d.price as number }));

  const openPrice = vwap(priceLegs(entries));
  const closePrice = closed ? vwap(priceLegs(exits)) : null;

  const openTime = entries[0]?.time ?? null;
  const closeTime = closed ? (exits[exits.length - 1]?.time ?? null) : null;
  const durationSec =
    openTime != null && closeTime != null
      ? Math.round(
          (new Date(closeTime).getTime() - new Date(openTime).getTime()) / 1000
        )
      : null;

  let profit = 0;
  let commission = 0;
  let swap = 0;
  for (const d of positionDeals) {
    profit += d.profit ?? 0;
    commission += d.commission ?? 0;
    swap += d.swap ?? 0;
  }

  return {
    positionId: first.positionId as string,
    symbol: first.symbol ?? "",
    direction,
    status: closed ? "closed" : "open",
    volume: enteredVolume > VOLUME_EPSILON ? enteredVolume : exitedVolume,
    openPrice,
    closePrice,
    openTime,
    closeTime,
    profit,
    commission,
    swap,
    netProfit: profit + commission + swap,
    durationSec,
  };
}

/**
 * Fold raw MT5 deals into reconstructed trades + cash flows.
 * Deterministic on out-of-order input. Idempotent: feeding the same deals
 * (or a superset of a position's deals) always yields the same trade row.
 */
export function reconstructTrades(deals: MetaApiDeal[]): ReconstructionResult {
  // Dedup by deal id first — a repeated id (overlapping sync windows, a
  // re-sent page) would otherwise double-count the trade's P&L, volume,
  // commission and swap. Last-seen wins, so a re-sent deal carries its latest
  // values. This makes reconstruction truly idempotent as the contract states.
  const unique = new Map<string, MetaApiDeal>();
  for (const d of deals) unique.set(d.id, d);
  const sorted = [...unique.values()].sort(compareDeals);

  const cashFlows: CashFlow[] = [];
  const byPosition = new Map<string, MetaApiDeal[]>();

  for (const d of sorted) {
    if (d.type === "DEAL_TYPE_BALANCE") {
      cashFlows.push({
        dealId: d.id,
        amount: d.profit ?? 0,
        time: d.time,
        comment: d.comment ?? null,
      });
      continue;
    }
    if (!TRADE_TYPES.has(d.type) || !d.positionId) continue;
    const list = byPosition.get(d.positionId);
    if (list) list.push(d);
    else byPosition.set(d.positionId, [d]);
  }

  const trades: ReconstructedTrade[] = [];
  for (const positionDeals of byPosition.values()) {
    const trade = buildTrade(positionDeals);
    if (trade) trades.push(trade);
  }

  return { trades, cashFlows };
}
