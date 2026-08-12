import { describe, it, expect } from "vitest";
import { reconstructTrades } from "./reconstruct";
import { computeAnalytics } from "./analytics";
import { detectLeaks } from "./leaks";
import { evaluateRules } from "./rules";
import { computeGameState } from "./gamification";
import { accountHealth } from "./health";
import type {
  MetaApiDeal,
  JournalTradeRow,
  JournalCashFlowRow,
  JournalRulesConfig,
  JournalGoalsRow,
} from "./types";

// Deterministic PRNG so a failure is reproducible from the seed.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- hard invariants: unambiguous bugs only (crash, NaN/∞, impossible bounds) ----
function isFiniteOrNull(x: unknown): boolean {
  return x == null || (typeof x === "number" && Number.isFinite(x));
}
function assertAnalyticsSane(a: Record<string, unknown>, ctx: string) {
  for (const [k, v] of Object.entries(a)) {
    if (typeof v === "number" || v == null) {
      expect(isFiniteOrNull(v), `${ctx}: ${k}=${String(v)} not finite`).toBe(true);
    }
  }
  if (a.winRate != null) {
    expect((a.winRate as number) >= 0 && (a.winRate as number) <= 1, `${ctx}: winRate ${a.winRate}`).toBe(true);
  }
  for (const k of ["closedCount", "openCount", "longestWinStreak", "longestLossStreak", "maxConcurrentOpen"]) {
    expect((a[k] as number) >= 0, `${ctx}: ${k} negative`).toBe(true);
  }
  if (a.profitFactor != null) expect((a.profitFactor as number) >= 0).toBe(true);
  expect((a.maxDrawdown as number) >= 0, `${ctx}: maxDrawdown negative`).toBe(true);
}

const DIRS = ["DEAL_TYPE_BUY", "DEAL_TYPE_SELL"];
const ENTRIES = ["DEAL_ENTRY_IN", "DEAL_ENTRY_OUT", "DEAL_ENTRY_INOUT", "DEAL_ENTRY_OUT_BY", undefined];

const T0 = Date.UTC(2026, 0, 1);
const iso = (min: number) => new Date(T0 + min * 60_000).toISOString();

// Realistic-adversarial MT5 deal stream: per-position CAUSAL sequences (entries
// before exits, strictly increasing times — a close can never precede its open),
// plus balance deals and junk types. Wide value ranges, omitted fields, occasional
// duplicate ids and huge P&L. The whole stream is time-sorted, as MetaApi feeds it.
function randDeals(rnd: () => number): MetaApiDeal[] {
  const num = (scale: number) => {
    const r = rnd();
    if (r < 0.15) return undefined; // omitted field (MetaApi does this)
    if (r < 0.2) return 0;
    const v = (rnd() - 0.4) * scale;
    return rnd() < 0.02 ? v * 1e6 : v; // occasional huge value (signed)
  };
  const pnum = (scale: number) => {
    const v = num(scale); // volume & price are non-negative in a real feed
    return v == null ? undefined : Math.abs(v);
  };
  const deals: MetaApiDeal[] = [];
  let idc = 0;
  const nPos = Math.floor(rnd() * 7); // 0..6 positions (0 ⇒ possibly empty)
  const sym = () => ["XAUUSD", "EURUSD", "GBPUSD"][Math.floor(rnd() * 3)];
  const mk = (posId: string | undefined, type: string, entry: string | undefined, t: number): MetaApiDeal => ({
    id: rnd() < 0.03 ? "dup" : `d${idc++}`, // occasional duplicate id
    positionId: posId,
    symbol: rnd() < 0.1 ? undefined : sym(),
    type,
    entryType: entry, // MetaApi always sends this
    // a real MT5 trade deal always carries positive volume (0/undefined only
    // happens for balance deals) — see the zero-volume edge noted in the report
    volume: (rnd() < 0.02 ? 1e6 : 1) * (0.01 + Math.abs(rnd() * 5)),
    price: pnum(2000),
    profit: num(1000),
    commission: num(20),
    swap: num(20),
    time: iso(t),
  });

  for (let k = 0; k < nPos; k++) {
    const base = Math.floor(rnd() * 40000);
    let seq = 0;
    const long = rnd() < 0.5;
    const inType = long ? "DEAL_TYPE_BUY" : "DEAL_TYPE_SELL";
    const outType = long ? "DEAL_TYPE_SELL" : "DEAL_TYPE_BUY";
    const nIn = 1 + Math.floor(rnd() * 3); // scale-ins
    const nOut = rnd() < 0.7 ? 1 + Math.floor(rnd() * 2) : 0; // 0 ⇒ still open
    for (let e = 0; e < nIn; e++) deals.push(mk(`p${k}`, inType, "DEAL_ENTRY_IN", base + seq++));
    for (let x = 0; x < nOut; x++) deals.push(mk(`p${k}`, outType, "DEAL_ENTRY_OUT", base + seq++));
  }
  // balance deals + junk-type + the occasional orphan (no positionId)
  const nExtra = Math.floor(rnd() * 4);
  for (let i = 0; i < nExtra; i++) {
    const t = Math.floor(rnd() * 40000);
    const r = rnd();
    if (r < 0.6) deals.push({ id: `b${idc++}`, type: "DEAL_TYPE_BALANCE", profit: num(5000), time: iso(t), comment: "cash" });
    else if (r < 0.85) deals.push({ id: `j${idc++}`, type: "DEAL_TYPE_CREDIT", time: iso(t) });
    else deals.push(mk(undefined, DIRS[Math.floor(rnd() * 2)], "DEAL_ENTRY_IN", t));
  }
  deals.sort((a, b) => a.time.localeCompare(b.time)); // as the feed delivers it
  return deals;
}

function toRow(rt: ReturnType<typeof reconstructTrades>["trades"][number], i: number): JournalTradeRow {
  return {
    id: `t${i}`,
    account_id: "a",
    position_id: rt.positionId,
    symbol: rt.symbol,
    direction: rt.direction,
    status: rt.status,
    volume: rt.volume,
    open_price: rt.openPrice,
    close_price: rt.closePrice,
    open_time: rt.openTime,
    close_time: rt.closeTime,
    profit: rt.profit,
    commission: rt.commission,
    swap: rt.swap,
    net_profit: rt.netProfit,
    duration_sec: rt.durationSec,
    note: null,
    tags: null,
    emotion: null,
  };
}

const RULES: JournalRulesConfig = {
  max_daily_loss: { enabled: true, value: 300 },
  max_trades_per_day: { enabled: true, value: 5 },
};
const GOALS = { max_drawdown_pct: 15, monthly_target_pct: 10, risk_per_trade_pct: 1 } as unknown as JournalGoalsRow;
const NOW = "2026-06-15T12:00:00.000Z";

describe("journal engines — adversarial fuzz (full pipeline)", () => {
  it("never throws / emits NaN across 4000 random adversarial datasets", () => {
    let deepestTrades = 0;
    for (let seed = 1; seed <= 4000; seed++) {
      const rnd = mulberry32(seed);
      const deals = randDeals(rnd);

      // 1) reconstruction
      const recon = reconstructTrades(deals);
      for (const t of recon.trades) {
        for (const v of [t.volume, t.profit, t.commission, t.swap, t.netProfit, t.openPrice, t.closePrice, t.durationSec]) {
          expect(isFiniteOrNull(v), `seed ${seed}: recon numeric ${String(v)}`).toBe(true);
        }
        // documented invariant: net = profit + commission + swap
        expect(Math.abs(t.netProfit - (t.profit + t.commission + t.swap)) < 1e-6, `seed ${seed}: netProfit mismatch`).toBe(true);
        if (t.status === "closed") expect(t.closeTime, `seed ${seed}: closed w/o closeTime`).not.toBeNull();
        if (t.durationSec != null) expect(t.durationSec >= 0, `seed ${seed}: negative duration`).toBe(true);
        expect(t.volume >= 0, `seed ${seed}: negative volume`).toBe(true);
      }
      for (const cf of recon.cashFlows) expect(Number.isFinite(cf.amount)).toBe(true);

      // 2) map to rows and run the whole analytics stack
      const rows = recon.trades.map(toRow);
      deepestTrades = Math.max(deepestTrades, rows.length);
      const cashFlows: JournalCashFlowRow[] = recon.cashFlows.map((c, i) => ({
        id: `c${i}`, account_id: "a", deal_id: c.dealId, amount: c.amount, time: c.time, comment: c.comment,
      }));

      const analytics = computeAnalytics(rows, cashFlows);
      assertAnalyticsSane(analytics as unknown as Record<string, unknown>, `seed ${seed}`);

      // downstream engines must also survive the same data
      expect(() => detectLeaks(rows, GOALS, analytics)).not.toThrow();
      expect(() => evaluateRules(rows, RULES, GOALS, analytics.startingBalance)).not.toThrow();
      expect(() => accountHealth(rows, analytics, GOALS, 0)).not.toThrow();
      expect(() =>
        computeGameState({ analytics, rulesConfig: RULES, goals: GOALS, trades: rows, now: NOW })
      ).not.toThrow();

      const g = computeGameState({ analytics, rulesConfig: RULES, goals: GOALS, trades: rows, now: NOW });
      expect(isFiniteOrNull(g.score)).toBe(true);
      expect(g.cleanDaysThisWeek >= 0 && g.tradingDaysThisWeek >= 0).toBe(true);
      expect(g.cleanDaysThisWeek <= g.tradingDaysThisWeek, `seed ${seed}: clean > trading days`).toBe(true);
    }
    expect(deepestTrades).toBeGreaterThan(0); // sanity: the fuzzer produced real trades
  });

  it("survives pathological hand-crafted inputs", () => {
    const cases: MetaApiDeal[][] = [
      [], // empty
      [{ id: "d1", type: "DEAL_TYPE_BUY", entryType: "DEAL_ENTRY_IN", positionId: "p1", volume: 1, price: 100, time: "2026-01-01T00:00:00Z" }], // open, never closed
      [ // duplicate deal ids, same position
        { id: "x", type: "DEAL_TYPE_BUY", entryType: "DEAL_ENTRY_IN", positionId: "p", volume: 1, price: 100, time: "2026-01-01T00:00:00Z" },
        { id: "x", type: "DEAL_TYPE_SELL", entryType: "DEAL_ENTRY_OUT", positionId: "p", volume: 1, price: 110, profit: 10, time: "2026-01-01T01:00:00Z" },
      ],
      [ // out-of-order times (close before open in the array)
        { id: "b", type: "DEAL_TYPE_SELL", entryType: "DEAL_ENTRY_OUT", positionId: "p", volume: 2, price: 90, profit: -20, time: "2026-01-02T05:00:00Z" },
        { id: "a", type: "DEAL_TYPE_BUY", entryType: "DEAL_ENTRY_IN", positionId: "p", volume: 2, price: 100, time: "2026-01-02T01:00:00Z" },
      ],
      [ // scale-in then single partial close
        { id: "1", type: "DEAL_TYPE_BUY", entryType: "DEAL_ENTRY_IN", positionId: "p", volume: 1, price: 100, time: "2026-01-03T01:00:00Z" },
        { id: "2", type: "DEAL_TYPE_BUY", entryType: "DEAL_ENTRY_IN", positionId: "p", volume: 2, price: 110, time: "2026-01-03T02:00:00Z" },
        { id: "3", type: "DEAL_TYPE_SELL", entryType: "DEAL_ENTRY_OUT", positionId: "p", volume: 1, price: 120, profit: 20, time: "2026-01-03T03:00:00Z" },
      ],
      [ // balance-only (deposit + withdrawal)
        { id: "dep", type: "DEAL_TYPE_BALANCE", profit: 10000, time: "2026-01-01T00:00:00Z", comment: "deposit" },
        { id: "wd", type: "DEAL_TYPE_BALANCE", profit: -2000, time: "2026-01-05T00:00:00Z", comment: "withdrawal" },
      ],
      [ // zero volume / zero price
        { id: "z1", type: "DEAL_TYPE_BUY", entryType: "DEAL_ENTRY_IN", positionId: "z", volume: 0, price: 0, time: "2026-01-06T01:00:00Z" },
        { id: "z2", type: "DEAL_TYPE_SELL", entryType: "DEAL_ENTRY_OUT", positionId: "z", volume: 0, price: 0, profit: 0, time: "2026-01-06T02:00:00Z" },
      ],
    ];
    for (let i = 0; i < cases.length; i++) {
      const recon = reconstructTrades(cases[i]);
      const rows = recon.trades.map(toRow);
      const cf: JournalCashFlowRow[] = recon.cashFlows.map((c, j) => ({
        id: `c${j}`, account_id: "a", deal_id: c.dealId, amount: c.amount, time: c.time, comment: c.comment,
      }));
      const analytics = computeAnalytics(rows, cf);
      assertAnalyticsSane(analytics as unknown as Record<string, unknown>, `case ${i}`);
      expect(() => detectLeaks(rows, GOALS, analytics)).not.toThrow();
      expect(() => evaluateRules(rows, RULES, GOALS, analytics.startingBalance)).not.toThrow();
      expect(() => accountHealth(rows, analytics, null, 0)).not.toThrow();
    }
  });
});
