import { describe, it, expect } from "vitest";
import { readStats, disclaimerError, valueSize, MAX_STATS } from "./statCard";

const four = {
  stat1Label: "WIN RATE", stat1Value: "57.9%", stat1Sub: "124 W / 90 L",
  stat2Label: "NET P&L", stat2Value: "1,238.00 USD", stat2Sub: "214 closed",
  stat3Label: "PROFIT FACTOR", stat3Value: "1.12", stat3Sub: "a thin margin",
  stat4Label: "EXPECTANCY", stat4Value: "5.79 USD", stat4Sub: "per trade",
};

describe("disclaimerError", () => {
  it("refuses to render a stat card with no disclaimer", () => {
    // The marketing site never shows these figures without one. A template that CAN
    // omit it will eventually omit it, so the renderer refuses instead.
    expect(disclaimerError({ ...four })).toMatch(/disclaimer/i);
  });

  it("refuses a disclaimer that is only whitespace", () => {
    expect(disclaimerError({ ...four, disclaimer: "   " })).toMatch(/disclaimer/i);
  });

  it("refuses a disclaimer too short to say anything", () => {
    expect(disclaimerError({ ...four, disclaimer: "example" })).toMatch(/disclaimer/i);
  });

  it("accepts the wording the marketing site already uses", () => {
    expect(
      disclaimerError({
        ...four,
        disclaimer:
          "Illustrative example profile — not a member's results, not typical, and not a projection of yours.",
      })
    ).toBeNull();
  });
});

describe("readStats", () => {
  it("reads the flat slot triples in order", () => {
    const stats = readStats(four);
    expect(stats).toHaveLength(4);
    expect(stats[0]).toEqual({ label: "WIN RATE", value: "57.9%", sub: "124 W / 90 L", featured: false });
    expect(stats[3].label).toBe("EXPECTANCY");
  });

  it("skips a stat with no value, rather than drawing an empty tile", () => {
    const stats = readStats({ ...four, stat3Value: "" });
    expect(stats.map((s) => s.label)).toEqual(["WIN RATE", "NET P&L", "EXPECTANCY"]);
  });

  it("tolerates a missing sub", () => {
    const stats = readStats({ stat1Label: "WIN RATE", stat1Value: "57.9%" });
    expect(stats[0].sub).toBe("");
  });

  it("marks the featured tile, and only that one", () => {
    const stats = readStats({ ...four, feature: "2" });
    expect(stats.map((s) => s.featured)).toEqual([false, true, false, false]);
  });

  it("ignores a feature index that is out of range", () => {
    expect(readStats({ ...four, feature: "9" }).some((s) => s.featured)).toBe(false);
    expect(readStats({ ...four, feature: "nonsense" }).some((s) => s.featured)).toBe(false);
  });

  it("never returns more tiles than the layout can hold", () => {
    const many: Record<string, string> = { ...four };
    for (let i = 5; i <= 9; i++) {
      many[`stat${i}Label`] = `L${i}`;
      many[`stat${i}Value`] = `V${i}`;
    }
    expect(readStats(many).length).toBeLessThanOrEqual(MAX_STATS);
  });
});

describe("valueSize", () => {
  it("keeps short values large", () => {
    expect(valueSize("1.12")).toBe(valueSize("57.9%"));
  });

  it("steps down for a long value so the tile does not overrun", () => {
    // Satori has no text-overflow handling worth relying on.
    expect(valueSize("1,238.00 USD")).toBeLessThan(valueSize("1.12"));
    expect(valueSize("412.00 / −486.00 USD")).toBeLessThan(valueSize("1,238.00 USD"));
  });
});
