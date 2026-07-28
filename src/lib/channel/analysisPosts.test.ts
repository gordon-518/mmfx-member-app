import { describe, it, expect } from "vitest";
import { parseTelegramTxt } from "@/lib/channel/analysisPosts";

const SAMPLE = `========================================
TELEGRAM POST 1 — DAILY ANALYSIS
Image: MMFX_Thumbnail_2026-06-12.png (1920x1080)
Format: Telegram Markdown
========================================

⚜️ **XAUUSD Daily Analysis — 12 June 2026**

Body of the daily read here.

Full breakdown ⬇️
__[attach PDF]__


========================================
TELEGRAM POST 2 — FUNDAMENTAL ANALYSIS
Image: MMFX_Macro_2026-06-12.png (1080x1080 square)
Format: Telegram Markdown
========================================

⚜️ **MACRO LAYERS · XAUUSD**
The macro body here.
`;

describe("parseTelegramTxt", () => {
  it("extracts the daily and macro bodies", () => {
    const { daily, macro } = parseTelegramTxt(SAMPLE);
    expect(daily).toContain("XAUUSD Daily Analysis — 12 June 2026");
    expect(daily).toContain("Body of the daily read");
    expect(macro).toContain("MACRO LAYERS");
    expect(macro).toContain("The macro body here");
  });
  it("strips the attach-PDF / full-breakdown trailer from the daily body", () => {
    const { daily } = parseTelegramTxt(SAMPLE);
    expect(daily).not.toContain("attach PDF");
    expect(daily).not.toContain("Full breakdown");
  });
  it("returns empty strings when a section is absent", () => {
    expect(parseTelegramTxt("no posts here")).toEqual({ daily: "", macro: "" });
  });
});
