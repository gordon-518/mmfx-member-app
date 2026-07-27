import { describe, expect, it } from "vitest";
import {
  decideInterventions,
  filterUnsent,
  isoWeek,
  type InterventionSignals,
  type SentRecord,
} from "./interventions";

const MONDAY = "2026-07-27T13:00:00.000Z"; // a Monday
const emptyLeaks = { leaks: [], strengths: [] };
const emptyRules = { score: null, cleanDays: 0, tradingDays: 0, perRule: [], breaches: [] };

function signals(over: Partial<InterventionSignals>): InterventionSignals {
  return {
    health: { status: "healthy", runwaySentence: "", factors: [] } as never,
    leaks: emptyLeaks as never,
    rules: emptyRules as never,
    lastTradeAt: "2026-07-26T10:00:00.000Z",
    hasClosedTrades: true,
    ...over,
  };
}

describe("isoWeek", () => {
  it("formats YYYY-Www", () => {
    expect(isoWeek("2026-07-27T00:00:00.000Z")).toMatch(/^2026-W\d{2}$/);
  });
  it("handles the year-end rollover (2021-01-01 is ISO 2020-W53)", () => {
    expect(isoWeek("2021-01-01T00:00:00.000Z")).toBe("2020-W53");
  });
});

describe("decideInterventions", () => {
  it("always includes a weekly_focus", () => {
    const out = decideInterventions(signals({}), MONDAY);
    expect(out.find((i) => i.kind === "weekly_focus")).toBeTruthy();
  });

  it("weekly focus leads with the #1 leak when present", () => {
    const leaks = { leaks: [{ title: "Trading after losses", detail: "18 trades.", dollarImpact: -1240 }], strengths: [] };
    const out = decideInterventions(signals({ leaks: leaks as never }), MONDAY);
    const wf = out.find((i) => i.kind === "weekly_focus")!;
    expect(wf.headline).toContain("Trading after losses");
  });

  it("weekly focus falls back to the worst broken rule", () => {
    const rules = { score: 50, cleanDays: 1, tradingDays: 2, breaches: [],
      perRule: [{ rule: "max_lots", title: "Max position size", unit: "trade", kept: 1, total: 5, breachCount: 4, enabled: true }] };
    const out = decideInterventions(signals({ rules: rules as never }), MONDAY);
    expect(out.find((i) => i.kind === "weekly_focus")!.headline).toContain("Max position size");
  });

  it("fires blowup_alert only when health is critical", () => {
    expect(decideInterventions(signals({}), MONDAY).some((i) => i.kind === "blowup_alert")).toBe(false);
    const crit = signals({ health: { status: "critical", runwaySentence: "~2 losing trades from your 10% limit", factors: [] } as never });
    const ba = decideInterventions(crit, MONDAY).find((i) => i.kind === "blowup_alert")!;
    expect(ba.severity).toBe("critical");
    expect(ba.body).toContain("~2 losing trades");
    expect(ba.channels).toContain("email");
  });

  it("fires inactivity_nudge at the 10-day boundary, email-only", () => {
    const inactive = signals({ lastTradeAt: "2026-07-10T10:00:00.000Z" }); // 17 days before MONDAY
    const iv = decideInterventions(inactive, MONDAY).find((i) => i.kind === "inactivity_nudge")!;
    expect(iv.channels).toEqual(["email"]);
    expect(iv.episodeKey).toBe("inactivity:2026-07-10");
    // just under threshold → no nudge
    const recent = signals({ lastTradeAt: "2026-07-20T10:00:00.000Z" }); // 7 days
    expect(decideInterventions(recent, MONDAY).some((i) => i.kind === "inactivity_nudge")).toBe(false);
  });
});

describe("filterUnsent", () => {
  const base = decideInterventions(
    signals({ health: { status: "critical", runwaySentence: "x", factors: [] } as never, lastTradeAt: "2026-07-01T10:00:00.000Z" }),
    MONDAY
  );

  it("drops already-logged episodes", () => {
    const wf = base.find((i) => i.kind === "weekly_focus")!;
    const log: SentRecord[] = [{ kind: "weekly_focus", episode_key: wf.episodeKey, sent_at: MONDAY }];
    const out = filterUnsent(base, log, MONDAY);
    expect(out.some((i) => i.kind === "weekly_focus")).toBe(false);
  });

  it("only sends weekly_focus on a Monday", () => {
    const tuesday = "2026-07-28T13:00:00.000Z";
    const out = filterUnsent(base, [], tuesday);
    expect(out.some((i) => i.kind === "weekly_focus")).toBe(false);
  });

  it("honours the 48h blowup cooldown", () => {
    const log: SentRecord[] = [{ kind: "blowup_alert", episode_key: "blowup:2026-07-26", sent_at: "2026-07-26T13:00:00.000Z" }];
    const out = filterUnsent(base, log, MONDAY); // 24h later
    expect(out.some((i) => i.kind === "blowup_alert")).toBe(false);
  });

  it("keeps only email-channel interventions", () => {
    const out = filterUnsent(base, [], MONDAY);
    expect(out.every((i) => i.channels.includes("email"))).toBe(true);
  });
});
