import { describe, it, expect } from "vitest";
import { LOCALES } from "@/i18n/config";
import { MESSAGES } from "@/i18n/messages";
import { MONEY_CLAIM, leaves } from "@/i18n/moneyClaims";
import { JOURNAL_EMOTIONS } from "./types";
import { sessionOf } from "./analytics";
import { detectLeaks } from "./leaks";
import { evaluateRules } from "./rules";
import { decideInterventions } from "./interventions";
import { computeAnalytics } from "./analytics";
import type { JournalTradeRow } from "./types";

const NAMESPACES = ["journal", "journalEngine", "journalConnect"] as const;
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

describe("journal translations", () => {
  it("every message keeps English's placeholders in every language", () => {
    for (const ns of NAMESPACES) {
      const en = new Map(leaves(MESSAGES.en[ns]));
      for (const locale of LOCALES) {
        for (const [path, text] of leaves(MESSAGES[locale][ns])) {
          expect(placeholders(text), `${locale}/${ns}.${path}`).toEqual(placeholders(en.get(path)!));
        }
      }
    }
  });

  it("labels every stored emotion, session and weekday", () => {
    const sessions = new Set([0, 3, 7, 10, 13, 16, 22].map(sessionOf));
    for (const locale of LOCALES) {
      const m = MESSAGES[locale].journalEngine;
      for (const e of JOURNAL_EMOTIONS) expect(m.emotions[e], `${locale}/${e}`).toBeTruthy();
      for (const s of sessions) expect((m.sessions as Record<string, string>)[s], `${locale}/${s}`).toBeTruthy();
      for (const d of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Unknown"])
        expect((m.weekdays as Record<string, string>)[d], `${locale}/${d}`).toBeTruthy();
    }
  });

  // Metric labels ("Net P&L", "Profit factor", 盈利因子) describe the member's own
  // numbers and legitimately use the words, so the scan covers the copy that
  // describes the product and the coaching nudges, not the stats.
  it("the descriptive copy and nudges make no profit or return claims", () => {
    for (const locale of LOCALES) {
      const t = MESSAGES[locale];
      const copy = [
        ...leaves(t.journal.empty),
        ...leaves(t.journal.firstRun),
        ...leaves(t.journal.mission),
        ...leaves({ coach: t.journal.coach.empty, goals: t.journal.goals.empty, rules: t.journal.rules.empty }),
        ...leaves(t.journalEngine.interventions),
        ...leaves(t.journalConnect),
      ];
      const offending = copy.filter(([, s]) => MONEY_CLAIM[locale].test(s));
      expect(offending, locale).toEqual([]);
    }
  });
});

describe("engines in the reader's language", () => {
  const trade = (i: number, net: number, hour = 9): JournalTradeRow => ({
    id: `t${i}`, account_id: "a", position_id: `p${i}`, symbol: "XAUUSD", direction: "buy", status: "closed",
    volume: 1, open_price: 1, close_price: 1,
    open_time: `2026-10-0${1 + (i % 5)}T${String(hour).padStart(2, "0")}:00:00.000Z`,
    close_time: `2026-10-0${1 + (i % 5)}T${String(hour + 1).padStart(2, "0")}:00:00.000Z`,
    profit: net, commission: 0, swap: 0, net_profit: net, duration_sec: 3600, note: null, tags: null, emotion: null,
  });
  // Three losses in a row, then more trades: a revenge-trading leak.
  const trades = [-50, -40, -30, -20, 10, -60, 5].map((n, i) => trade(i, n));
  const zh = MESSAGES["zh-Hans"].journalEngine;

  it("writes leaks in the reader's language and English by default", () => {
    const a = computeAnalytics(trades, []);
    const en = detectLeaks(trades, null, a).leaks.find((l) => l.type === "revenge_trading")!;
    const cn = detectLeaks(trades, null, a, zh).leaks.find((l) => l.type === "revenge_trading")!;
    expect(en.title).toBe("Trading after losses");
    expect(cn.title).toBe(zh.leaks.revengeTradingTitle);
    expect(cn.detail).not.toMatch(/[A-Za-z]{4,}/);
    expect(cn.dollarImpact).toBe(en.dollarImpact);
  });

  it("names a broken session rule's session in the reader's language", () => {
    const config = { allowed_sessions: { enabled: true, value: ["London"] } };
    const r = evaluateRules([trade(1, 10, 15)], config, null, 1000, zh);
    expect(r.breaches[0].title).toBe(zh.rules.titles.allowed_sessions);
    expect(r.breaches[0].detail).toBe("在纽约盘交易");
  });

  it("keeps the weekly focus title separate from its lead-in", () => {
    const a = computeAnalytics(trades, []);
    const signals = {
      health: { status: "healthy", runwaySentence: "", factors: [] } as never,
      leaks: detectLeaks(trades, null, a, zh),
      rules: evaluateRules(trades, {}, null, 1000, zh),
      lastTradeAt: null,
      hasClosedTrades: true,
    };
    const focus = decideInterventions(signals, "2026-10-06T00:00:00.000Z", zh).find((i) => i.kind === "weekly_focus")!;
    expect(focus.headline.startsWith("本周重点：")).toBe(true);
    expect(focus.title).toBe(signals.leaks.leaks[0].title);
  });
});
