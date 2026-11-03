import { describe, it, expect } from "vitest";
import { fmtDuration, fmtTime, profitFactorLabel, splitFirst } from "./format";
import { MESSAGES } from "@/i18n/messages";

describe("profitFactorLabel", () => {
  it("shows the number when there are losses", () => {
    expect(profitFactorLabel({ profitFactor: 1.84, grossWin: 5000 })).toBe("1.84");
  });
  it("shows ∞ for a flawless run (wins, no losses)", () => {
    expect(profitFactorLabel({ profitFactor: null, grossWin: 5000 })).toBe("∞");
  });
  it("shows — when there are no trades at all", () => {
    expect(profitFactorLabel({ profitFactor: null, grossWin: 0 })).toBe("—");
  });
});

describe("splitFirst", () => {
  it("splits English at the first sentence end", () => {
    expect(splitFirst("Size is the leak. Cut it in half. Then review.")).toEqual([
      "Size is the leak.",
      "Cut it in half. Then review.",
    ]);
  });
  it("doesn't split inside a price", () => {
    expect(splitFirst("Gold held 4,026.6 all day")).toEqual(["Gold held 4,026.6 all day", ""]);
  });
  it("splits Chinese at a full stop, which has no space after it", () => {
    expect(splitFirst("仓位是最大的漏洞。先减半。")).toEqual(["仓位是最大的漏洞。", "先减半。"]);
  });
  it("keeps a single sentence whole", () => {
    expect(splitFirst("只有一句。")).toEqual(["只有一句。", ""]);
  });
});

describe("fmtDuration", () => {
  it("keeps the English short units by default", () => {
    expect(fmtDuration(1800)).toBe("30m");
    expect(fmtDuration(5400)).toBe("1.5h");
    expect(fmtDuration(172800)).toBe("2.0d");
    expect(fmtDuration(null)).toBe("—");
  });
  it("uses the reader's units", () => {
    expect(fmtDuration(1800, MESSAGES["zh-Hans"].journal.durations)).toBe("30分钟");
  });
});

describe("fmtTime", () => {
  it("formats in the reader's language", () => {
    expect(fmtTime("2026-11-04T06:30:00Z")).toMatch(/Nov/);
    expect(fmtTime("2026-11-04T06:30:00Z", "zh-CN")).toMatch(/11月/);
    expect(fmtTime(null)).toBe("—");
  });
});
