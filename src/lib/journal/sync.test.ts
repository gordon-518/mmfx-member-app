import { describe, expect, it } from "vitest";
import {
  fetchStoredDealsForPositions,
  nextCursor,
  syncWindowStart,
} from "./sync";
import type { MetaApiDeal } from "./types";

function deal(id: string, time: string): MetaApiDeal {
  return { id, type: "DEAL_TYPE_BUY", time };
}

/**
 * Minimal stand-in for the supabase-js query builder: supports the
 * .from().select().eq().in().range() chain and pages a backing array by range,
 * matching PostgREST's inclusive [from, to] and 1000-row response cap.
 */
function makeDb(store: Record<string, unknown>[], maxRows = 1000) {
  const rangeCalls: { ids: string[]; from: number; to: number }[] = [];
  const db = {
    from() {
      let account = "";
      let ids: string[] = [];
      const b = {
        select: () => b,
        eq: (_col: string, val: string) => ((account = val), b),
        in: (_col: string, vals: string[]) => ((ids = vals), b),
        range: (from: number, to: number) => {
          rangeCalls.push({ ids, from, to });
          const matched = store.filter(
            (r) => r.account_id === account && ids.includes(r.position_id as string)
          );
          const capped = Math.min(to, from + maxRows - 1);
          return Promise.resolve({
            data: matched.slice(from, capped + 1),
            error: null,
          });
        },
      };
      return b;
    },
  };
  return { db, rangeCalls };
}

function storedDeal(positionId: string, i: number) {
  return {
    account_id: "acc",
    deal_id: `${positionId}-${i}`,
    position_id: positionId,
    type: "DEAL_TYPE_BUY",
    time: "2026-07-01T00:00:00.000Z",
  };
}

describe("fetchStoredDealsForPositions", () => {
  it("pages past the 1000-row cap so no deals are dropped", async () => {
    // One position with 1500 deals — the exact shape that truncated to 1000.
    const store = Array.from({ length: 1500 }, (_, i) => storedDeal("p1", i));
    const { db, rangeCalls } = makeDb(store);
    const out = await fetchStoredDealsForPositions(db as never, "acc", ["p1"]);
    expect(out).toHaveLength(1500);
    expect(new Set(out.map((d) => d.id)).size).toBe(1500);
    // Second page must have been requested.
    expect(rangeCalls.some((c) => c.from >= 1000)).toBe(true);
  });

  it("chunks a long position-id list instead of one oversized IN()", async () => {
    const ids = Array.from({ length: 400 }, (_, i) => `p${i}`);
    const store = ids.map((id) => storedDeal(id, 0));
    const { db, rangeCalls } = makeDb(store);
    const out = await fetchStoredDealsForPositions(db as never, "acc", ids);
    expect(out).toHaveLength(400);
    // 400 ids / 150-per-chunk = 3 chunks, none exceeding the chunk size.
    const chunkSizes = new Set(rangeCalls.map((c) => c.ids.length));
    expect(Math.max(...chunkSizes)).toBeLessThanOrEqual(150);
    expect(rangeCalls.length).toBeGreaterThanOrEqual(3);
  });
});

describe("syncWindowStart", () => {
  it("starts from the default epoch when there is no cursor", () => {
    expect(syncWindowStart(null).toISOString()).toBe(
      "2024-01-01T00:00:00.000Z"
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
