import { describe, it, expect } from "vitest";
import { dayLabel, monthLabel, weekdayLabel } from "./dates";

describe("date labels", () => {
  it("formats a calendar day in the reader's language, in UTC", () => {
    expect(dayLabel("2026-11-04", "en-GB")).toBe("4 Nov");
    expect(weekdayLabel("2026-11-04", "en-GB")).toBe("Wed");
    expect(monthLabel("2026-11-04", "en-GB")).toBe("November 2026");
    expect(monthLabel("2026-11-04", "zh-CN")).toBe("2026年11月");
  });

  it("accepts a full timestamp", () => {
    expect(dayLabel("2026-11-04T23:30:00Z", "en-GB")).toBe("4 Nov");
  });

  it("returns empty (or null) for a date it can't read", () => {
    expect(dayLabel("not a date", "en-GB")).toBe("");
    expect(weekdayLabel("", "en-GB")).toBe("");
    expect(monthLabel("nope", "en-GB")).toBeNull();
  });
});
