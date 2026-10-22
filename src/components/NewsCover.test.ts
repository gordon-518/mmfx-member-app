import { describe, it, expect } from "vitest";
import { coverLabel } from "./NewsCover";

// The cover's label is the one piece of judgement in a drawn cover: it has to
// read as something real. A truncated topic looks like a ticker that doesn't
// exist, which is worse than the stock photo it replaced.
const item = (title: string, topics: string[] = []) => ({ title, topics });

describe("news cover label", () => {
  it("reads the instrument out of the headline", () => {
    expect(coverLabel(item("Australian Dollar: Overbought rally eyeing 0.7070"))).toEqual({ text: "AUD", big: true });
    expect(coverLabel(item("WTI Oil rallies above $99"))).toEqual({ text: "OIL", big: true });
    expect(coverLabel(item("Canadian Dollar outperforms as markets turn defensive"))).toEqual({ text: "CAD", big: true });
    expect(coverLabel(item("China's central bank extends Gold-buying spree"))).toEqual({ text: "XAU", big: true });
  });

  it("turns a country into the currency a trader watches", () => {
    expect(coverLabel(item("Foreign Direct Investment slumps", ["China"]))).toEqual({ text: "CNY", big: true });
    expect(coverLabel(item("Hong Kong SAR Unemployment rate increased"))).toEqual({ text: "HKD", big: true });
  });

  it("never invents a ticker out of a topic it can't resolve", () => {
    // "unemployment" -> the word, small; NOT "UNE".
    expect(coverLabel(item("Jobless claims tick up", ["unemployment"]))).toEqual({
      text: "UNEMPLOYMENT",
      big: false,
    });
    expect(coverLabel(item("Something with no instrument", []))).toEqual({ text: "MACRO", big: false });
  });

  it("always returns something to draw", () => {
    for (const t of ["", "...", "Markets", "A very long headline with nothing tradable in it"]) {
      expect(coverLabel(item(t)).text.length).toBeGreaterThan(0);
    }
  });
});
