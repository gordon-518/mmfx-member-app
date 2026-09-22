import { describe, it, expect } from "vitest";
import { estimateLines, estimateBlockHeight, anchorFor, CONTENT_WIDTH } from "./renderLayout";

describe("estimateLines", () => {
  it("counts a short string as one line", () => {
    expect(estimateLines("Free in the app", 78, CONTENT_WIDTH)).toBe(1);
  });

  it("wraps a long string onto several lines", () => {
    // The live bias-card headline, which renders as 4 lines at 78px.
    const headline = "2.44% real yield, DXY at 99.4 — silver's bounce stalls under the H4 50 EMA";
    expect(estimateLines(headline, 78, CONTENT_WIDTH)).toBeGreaterThanOrEqual(3);
  });

  it("fits more characters per line at a smaller font size", () => {
    const text = "a".repeat(120);
    expect(estimateLines(text, 34, CONTENT_WIDTH)).toBeLessThan(
      estimateLines(text, 78, CONTENT_WIDTH)
    );
  });

  it("treats empty text as zero lines, not one", () => {
    // An unfilled optional slot must not inflate the block and push a short card
    // back into bottom-anchoring.
    expect(estimateLines("", 78, CONTENT_WIDTH)).toBe(0);
    expect(estimateLines("   ", 78, CONTENT_WIDTH)).toBe(0);
  });
});

describe("anchorFor", () => {
  const AVAILABLE = 1000;

  it("centres a block that fills little of the frame", () => {
    expect(anchorFor(120, AVAILABLE)).toBe("center");
  });

  it("bottom-anchors a block that fills most of the frame", () => {
    expect(anchorFor(700, AVAILABLE)).toBe("bottom");
  });

  it("bottom-anchors exactly at the threshold", () => {
    expect(anchorFor(AVAILABLE * 0.4, AVAILABLE)).toBe("bottom");
  });

  it("never divides by zero on a degenerate frame", () => {
    expect(anchorFor(100, 0)).toBe("bottom");
  });
});

describe("real templates land on the right anchor", () => {
  const AVAILABLE = 1350 - 72 * 2 - 34 - 80; // frame minus padding, wordmark, footer

  it("bottom-anchors the live bias-card, which has enough copy", () => {
    const h = estimateBlockHeight(
      [
        { text: "XAG/USD", fontSize: 34 },
        { text: "2.44% real yield, DXY at 99.4 — silver's bounce stalls under the H4 50 EMA", fontSize: 78, lineHeight: 1.08 },
        { text: "Gold/silver ratio near 67.3 shows silver lagging gold; the recovery from 63.88 stalled below the H4 50 EMA while the monetary headwind holds.", fontSize: 34, lineHeight: 1.35 },
      ],
      28,
      CONTENT_WIDTH
    );
    expect(anchorFor(h, AVAILABLE)).toBe("bottom");
  });

  it("centres the carousel CTA slide, which is the one that looked broken", () => {
    const h = estimateBlockHeight([{ text: "Free in the app", fontSize: 78, lineHeight: 1.15 }], 0, CONTENT_WIDTH);
    expect(anchorFor(h, AVAILABLE)).toBe("center");
  });

  it("centres the carousel hook slide", () => {
    const h = estimateBlockHeight(
      [{ text: "You took the trade. Then closed it at breakeven.", fontSize: 78, lineHeight: 1.15 }],
      0,
      CONTENT_WIDTH
    );
    expect(anchorFor(h, AVAILABLE)).toBe("center");
  });
});
