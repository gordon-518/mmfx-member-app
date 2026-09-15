import { describe, it, expect } from "vitest";
import {
  CARD_ROWS,
  FAQ,
  TIER_CONTENT,
  buildComparison,
  cardRowsMatchAccessMap,
  includes,
  recommendTier,
} from "./upgradeContent";

const CLAIM = /\b(profits?|profitable|returns?|earns?|earnings|income|guaranteed?)\b/i;

describe("tier cards", () => {
  it("each card row's tier matches the real access map", () => {
    expect(cardRowsMatchAccessMap()).toBe(true);
  });

  it("each tier includes everything below it", () => {
    const count = (t: "foundation" | "desk" | "team") => CARD_ROWS.filter((r) => includes(t, r)).length;
    expect(count("foundation")).toBe(2);
    expect(count("desk")).toBe(6);
    expect(count("team")).toBe(8);
  });
});

describe("comparison grid", () => {
  const grid = buildComparison();
  const col = (tier: string) => grid.map((r) => r.cells[tier]);

  it("Team MM has everything", () => {
    expect(col("team").every((c) => c !== false)).toBe(true);
  });

  it("Free has the free features, and Module 1 of the course", () => {
    const open = grid.filter((r) => r.cells.free !== false).map((r) => r.key).sort();
    expect(open).toEqual(["calendar", "course", "daily-analysis", "know-your-style", "news", "signals"]);
    expect(grid.find((r) => r.key === "course")?.cells.free).toBe("Module 1");
  });

  it("Desk adds live classes and the Fundamental Desk, not the calls", () => {
    const row = (k: string) => grid.find((r) => r.key === k)!.cells;
    expect(row("live-classes").desk).toBe(true);
    expect(row("fundamental-desk").foundation).toBe(false);
    expect(row("team-mm").desk).toBe(false);
  });
});

describe("recommendTier", () => {
  it("recommends by goal", () => {
    expect(recommendTier("learn", null, null).tier).toBe("foundation");
    expect(recommendTier("live", null, null).tier).toBe("desk");
    expect(recommendTier("calls", null, null).tier).toBe("team");
  });

  it("suggests starting lower and topping up when the budget is below the tier", () => {
    const r = recommendTier("calls", "50", null);
    expect(r.tier).toBe("team");
    expect(r.startNote).toMatch(/Start on Foundation/);
    expect(recommendTier("learn", "500", null).startNote).toBeNull();
  });

  it("adds the KYS archetype line when known", () => {
    expect(recommendTier("live", null, "The News Trader").archetypeLine).toMatch(/macro/);
    expect(recommendTier("live", null, "Unknown").archetypeLine).toBeNull();
  });
});

describe("copy compliance", () => {
  it("makes no earnings claims anywhere", () => {
    const all = JSON.stringify({ TIER_CONTENT, FAQ, r: recommendTier("calls", "50", "The Analysis Paralyser") });
    expect(all).not.toMatch(CLAIM);
  });
});
