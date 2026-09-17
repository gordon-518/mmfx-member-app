import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supportLine, supportStats } from "./summary";

describe("supportLine", () => {
  it("summarises the last 24 hours", () => {
    expect(supportLine({ replies: 42, handoffs: 5, waiting: 3, undelivered: 0, medianSeconds: 38 }))
      .toBe("<b>Support agent:</b> 42 replies · 5 handed to Amelia · 3 waiting · median reply 38s");
  });

  it("says so when there was no traffic", () => {
    expect(supportLine({ replies: 0, handoffs: 0, waiting: 0, undelivered: 0, medianSeconds: null }))
      .toBe("<b>Support agent:</b> no messages in the last 24h");
  });

  it("drops the median when there were no timed replies", () => {
    expect(supportLine({ replies: 0, handoffs: 2, waiting: 1, undelivered: 0, medianSeconds: null }))
      .toBe("<b>Support agent:</b> 0 replies · 2 handed to Amelia · 1 waiting");
  });

  it("flags outgoing messages that were never confirmed sent", () => {
    const line = supportLine({ replies: 10, handoffs: 1, waiting: 0, undelivered: 2, medianSeconds: 12 });
    expect(line).toContain("⚠️ 2 logged but never confirmed sent");
  });

  it("reports a quiet day that still has someone waiting", () => {
    expect(supportLine({ replies: 0, handoffs: 0, waiting: 4, undelivered: 0, medianSeconds: null }))
      .toContain("4 waiting");
  });
});

/** Minimal stand-in for the PostgREST builder: every filter returns the same
 * object, and awaiting it resolves to whatever this query was seeded with. */
function fakeDb(seed: {
  counts: Record<string, number>;
  latencies?: (number | null)[];
}) {
  const calls: string[] = [];
  const make = (table: string) => {
    let kind = "";
    let head = false;
    const q = {
      select: (_cols: string, opts?: { head?: boolean }) => { head = Boolean(opts?.head); return q; },
      eq: (col: string, val: string) => { if (col === "kind") kind = val; if (col === "state") kind = `state:${val}`; return q; },
      in: () => { kind = "undelivered"; return q; },
      is: () => q,
      not: () => q,
      gte: () => q,
      lt: () => q,
      order: () => q,
      limit: () => q,
      then: (res: (v: unknown) => void) => {
        const key = table === "support_chats" ? "waiting" : kind;
        calls.push(key);
        return Promise.resolve(
          head ? { count: seed.counts[key] ?? 0, error: null }
               : { data: (seed.latencies ?? []).map((latency_ms) => ({ latency_ms })), error: null },
        ).then(res);
      },
    };
    return q;
  };
  return { db: { from: (t: string) => make(t) } as unknown as SupabaseClient, calls };
}

describe("supportStats", () => {
  const since = new Date("2026-09-17T00:00:00Z");

  it("counts rows with count queries rather than fetching them", async () => {
    const { db, calls } = fakeDb({
      counts: { reply: 1200, handoff: 7, waiting: 3, undelivered: 1 },
      latencies: [4000, 8000, 12000],
    });
    const s = await supportStats(db, since);
    // 1,200 replies is past PostgREST's 1000-row default: a row fetch would
    // have undercounted, as an earlier feature in this codebase did.
    expect(s).toEqual({ replies: 1200, handoffs: 7, waiting: 3, undelivered: 1, medianSeconds: 8 });
    expect(calls).toContain("reply");
    expect(calls).toContain("waiting");
  });

  it("reports a null median when no reply carried a latency", async () => {
    const { db } = fakeDb({ counts: { reply: 0, handoff: 0, waiting: 0, undelivered: 0 }, latencies: [] });
    await expect(supportStats(db, since)).resolves.toMatchObject({ medianSeconds: null });
  });

  it("treats missing counts as zero", async () => {
    const { db } = fakeDb({ counts: {}, latencies: [] });
    await expect(supportStats(db, since)).resolves.toEqual({
      replies: 0, handoffs: 0, waiting: 0, undelivered: 0, medianSeconds: null,
    });
  });
});
