import { describe, expect, it } from "vitest";
import { evaluateRules } from "./rules";
import type { JournalTradeRow, JournalRulesConfig } from "./types";

let seq = 0;
function t(o: Partial<JournalTradeRow> & { net_profit: number; day: string }): JournalTradeRow {
  seq += 1;
  return {
    id: `t${seq}`,
    account_id: "a",
    position_id: `p${seq}`,
    symbol: "XAUUSD",
    direction: "buy",
    status: "closed",
    volume: 0.4,
    open_price: 1,
    close_price: 1,
    open_time: `${o.day}T10:00:00.000Z`,
    close_time: `${o.day}T12:00:00.000Z`,
    profit: o.net_profit,
    commission: 0,
    swap: 0,
    net_profit: o.net_profit,
    duration_sec: 1,
    note: null,
    tags: null,
    emotion: null,
    ...o,
  };
}

describe("evaluateRules", () => {
  it("max_daily_loss: breaches a day below the $ limit", () => {
    const trades = [
      t({ day: "2026-07-01", net_profit: -150 }),
      t({ day: "2026-07-01", net_profit: -100 }),
      t({ day: "2026-07-02", net_profit: 50 }),
    ];
    const cfg: JournalRulesConfig = { max_daily_loss: { enabled: true, value: 200 } };
    const r = evaluateRules(trades, cfg, null, 10000);
    expect(r.breaches.filter((b) => b.rule === "max_daily_loss").length).toBe(1); // day 01: -250 < -200
    expect(r.cleanDays).toBe(1);
    expect(r.tradingDays).toBe(2);
    expect(r.score).toBe(50);
  });

  it("max_daily_loss: is_pct uses starting balance", () => {
    const trades = [t({ day: "2026-07-01", net_profit: -600 })];
    const cfg: JournalRulesConfig = { max_daily_loss: { enabled: true, value: 5, is_pct: true } };
    const r = evaluateRules(trades, cfg, null, 10000); // 5% of 10000 = 500 < 600 → breach
    expect(r.breaches.some((b) => b.rule === "max_daily_loss")).toBe(true);
  });

  it("max_trades_per_day: breaches a day over the count", () => {
    const trades = Array.from({ length: 6 }, (_, i) =>
      t({ day: "2026-07-01", net_profit: 10, id: `x${i}` })
    );
    const cfg: JournalRulesConfig = { max_trades_per_day: { enabled: true, value: 5 } };
    const r = evaluateRules(trades, cfg, null, 10000);
    expect(r.breaches.some((b) => b.rule === "max_trades_per_day")).toBe(true);
    expect(r.score).toBe(0);
  });

  it("max_consec_losses: flags trading after N losses in a row", () => {
    const trades = [
      t({ day: "2026-07-01", net_profit: -10, id: "L1" }),
      t({ day: "2026-07-01", net_profit: -10, id: "L2" }),
      t({ day: "2026-07-01", net_profit: -10, id: "after" }),
    ];
    const cfg: JournalRulesConfig = { max_consec_losses: { enabled: true, value: 2 } };
    const r = evaluateRules(trades, cfg, null, 10000);
    const b = r.breaches.find((x) => x.rule === "max_consec_losses");
    expect(b!.tradeIds).toEqual(["after"]);
  });

  it("max_lots: per-trade breach with trade ids", () => {
    const trades = [
      t({ day: "2026-07-01", net_profit: 10, id: "ok", volume: 0.4 }),
      t({ day: "2026-07-01", net_profit: -10, id: "big", volume: 2.0 }),
    ];
    const cfg: JournalRulesConfig = { max_lots: { enabled: true, value: 1.0 } };
    const r = evaluateRules(trades, cfg, null, 10000);
    const b = r.breaches.find((x) => x.rule === "max_lots");
    expect(b!.tradeIds).toEqual(["big"]);
    const adh = r.perRule.find((p) => p.rule === "max_lots")!;
    expect(adh.unit).toBe("trade");
    expect(adh.kept).toBe(1);
    expect(adh.total).toBe(2);
  });

  it("instruments_only: inert without goals instruments", () => {
    const trades = [t({ day: "2026-07-01", net_profit: 10, symbol: "EURUSD" })];
    const cfg: JournalRulesConfig = { instruments_only: { enabled: true } };
    const r = evaluateRules(trades, cfg, null, 10000);
    expect(r.perRule.find((p) => p.rule === "instruments_only")!.inert).toBe(true);
    expect(r.breaches.length).toBe(0);
  });

  it("instruments_only: breaches off-instrument trades", () => {
    const trades = [t({ day: "2026-07-01", net_profit: 10, symbol: "EURUSD", id: "off" })];
    const cfg: JournalRulesConfig = { instruments_only: { enabled: true } };
    const r = evaluateRules(trades, cfg, { instruments: ["XAUUSD"] } as never, 10000);
    expect(r.breaches.find((b) => b.rule === "instruments_only")!.tradeIds).toEqual(["off"]);
  });

  it("no active rules → score null", () => {
    const r = evaluateRules([t({ day: "2026-07-01", net_profit: 10 })], {}, null, 10000);
    expect(r.score).toBeNull();
  });
});
