import { describe, it, expect } from "vitest";
import { sessionKey, sessionLabel } from "./sessions";
import { MESSAGES } from "@/i18n/messages";

describe("sessionKey", () => {
  it("reads every way the tag has been written as one session", () => {
    // The distinct values in daily_analysis.session_tag (4 Nov 2026).
    expect(["London Session", "London", "london"].map(sessionKey)).toEqual(["london", "london", "london"]);
    expect(["Asian Session", "asian", "Asia"].map(sessionKey)).toEqual(["asian", "asian", "asian"]);
    expect(["NY Session", "new york", "New York Session"].map(sessionKey)).toEqual(["newYork", "newYork", "newYork"]);
    expect(sessionKey("Pre-NY Session")).toBe("preNewYork");
  });

  it("returns null for an empty or unknown tag", () => {
    expect(sessionKey(null)).toBeNull();
    expect(sessionKey("")).toBeNull();
    expect(sessionKey("Sydney")).toBeNull();
  });
});

describe("sessionLabel", () => {
  it("translates a known session and keeps an unknown one as written", () => {
    expect(sessionLabel("london", MESSAGES.en.dailyAnalysis.sessions)).toBe("London session");
    expect(sessionLabel("London Session", MESSAGES["zh-Hans"].dailyAnalysis.sessions)).toBe("伦敦盘");
    expect(sessionLabel(" Sydney ", MESSAGES.en.dailyAnalysis.sessions)).toBe("Sydney");
    expect(sessionLabel(null, MESSAGES.en.dailyAnalysis.sessions)).toBeNull();
  });
});
