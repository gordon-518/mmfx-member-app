import { describe, it, expect } from "vitest";
import {
  CARD_ROWS,
  buildComparison,
  cardRowsMatchAccessMap,
  faq,
  includes,
  recommendTier,
  rowLabel,
  tierContent,
} from "./upgradeContent";
import { LOCALES } from "@/i18n/config";
import { MESSAGES } from "@/i18n/messages";
import { MONEY_CLAIM, leaves } from "@/i18n/moneyClaims";
import type { ArchetypeId } from "@/lib/kys/types";
import { ARCHETYPES } from "@/lib/kys/archetypes";

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

  it("fills the counts in from the real content", () => {
    expect(rowLabel("course")).toBe("The full course, all 19 lessons");
    expect(rowLabel("indicators")).toBe("10 TradingView indicators");
    expect(tierContent("foundation").adds).toMatch(/all 19 lessons/);
  });

  it("only Team MM carries the badge and the note", () => {
    expect(tierContent("team").badge).toBe("Most complete");
    expect(tierContent("desk").badge).toBeUndefined();
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

  it("reads in the reader's language", () => {
    const zh = buildComparison(MESSAGES["zh-Hans"].plans);
    expect(zh.find((r) => r.key === "course")?.cells.free).toBe("模块 1");
    expect(zh.find((r) => r.key === "indicators")?.label).toMatch(/^10 /);
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
    expect(r.startNote).toMatch(/\$500 in total/);
    expect(recommendTier("learn", "500", null).startNote).toBeNull();
  });

  it("adds the KYS archetype line, looked up by the ID profiles store", () => {
    expect(recommendTier("live", null, "news_trader").archetypeLine).toMatch(/macro/);
    expect(recommendTier("live", null, "unknown").archetypeLine).toBeNull();
  });

  it("no longer matches on the display name (it never did in production)", () => {
    expect(recommendTier("live", null, "The News Trader").archetypeLine).toBeNull();
  });

  it("has a line for every archetype in every language", () => {
    const ids = ARCHETYPES.map((a) => a.id as ArchetypeId);
    expect(ids).toHaveLength(8);
    for (const locale of LOCALES) {
      for (const id of ids) {
        const line = recommendTier("learn", null, id, MESSAGES[locale].plans, MESSAGES[locale].tiers).archetypeLine;
        expect(line, `${locale}/${id}`).toBeTruthy();
      }
    }
  });

  it("keeps the brand tier names in every language", () => {
    for (const locale of LOCALES) {
      const r = recommendTier("calls", "50", null, MESSAGES[locale].plans, MESSAGES[locale].tiers);
      expect(r.startNote, locale).toContain("Foundation");
      expect(r.startNote, locale).toContain("Team MM");
    }
  });
});

describe("copy compliance", () => {
  it("makes no earnings claims in any language", () => {
    for (const locale of LOCALES) {
      const offending = leaves(MESSAGES[locale].plans).filter(([, s]) => MONEY_CLAIM[locale].test(s));
      expect(offending, locale).toEqual([]);
    }
  });

  it("the FAQ has all six answers in every language", () => {
    for (const locale of LOCALES) {
      const items = faq(MESSAGES[locale].plans);
      expect(items).toHaveLength(6);
      expect(items.every((f) => f.q.length > 0 && f.a.length > 0)).toBe(true);
    }
  });
});
