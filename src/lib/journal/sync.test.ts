import { describe, expect, it } from "vitest";
import { nextCursor, syncWindowStart } from "./sync";
import type { MetaApiDeal } from "./types";

function deal(id: string, time: string): MetaApiDeal {
  return { id, type: "DEAL_TYPE_BUY", time };
}

describe("syncWindowStart", () => {
  it("starts from the default epoch when there is no cursor", () => {
    expect(syncWindowStart(null).toISOString()).toBe(
      "2000-01-01T00:00:00.000Z"
    );
  });

  it("rewinds 60s behind the cursor to avoid boundary gaps", () => {
    expect(syncWindowStart("2026-07-01T10:00:00.000Z").toISOString()).toBe(
      "2026-07-01T09:59:00.000Z"
    );
  });
});

describe("nextCursor", () => {
  it("keeps the previous cursor when no deals arrived", () => {
    expect(nextCursor([], "2026-07-01T10:00:00.000Z")).toBe(
      "2026-07-01T10:00:00.000Z"
    );
    expect(nextCursor([], null)).toBeNull();
  });

  it("advances to the max deal time", () => {
    const deals = [
      deal("1", "2026-07-01T10:00:00.000Z"),
      deal("2", "2026-07-01T12:00:00.000Z"),
      deal("3", "2026-07-01T11:00:00.000Z"),
    ];
    expect(nextCursor(deals, null)).toBe("2026-07-01T12:00:00.000Z");
  });

  it("never moves backwards (overlap re-fetches old deals)", () => {
    const deals = [deal("1", "2026-07-01T09:59:30.000Z")];
    expect(nextCursor(deals, "2026-07-01T10:00:00.000Z")).toBe(
      "2026-07-01T10:00:00.000Z"
    );
  });
});
