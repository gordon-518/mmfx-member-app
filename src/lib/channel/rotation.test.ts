import { describe, it, expect } from "vitest";
import { pickNext, pickVisual } from "@/lib/channel/rotation";
import type { LibraryItem, VisualItem } from "@/lib/channel/types";

function item(id: string, last: string | null, status: LibraryItem["status"] = "approved"): LibraryItem {
  return { id, kind: "educational", body: id, status, button_set: null, last_posted_at: last, times_posted: 0 };
}

describe("pickNext", () => {
  it("returns null when the pool is empty", () => {
    expect(pickNext([], 4)).toBeNull();
  });
  it("prefers a never-posted item (exploration)", () => {
    const picked = pickNext([item("a", "2026-06-01T00:00:00Z"), item("b", null)], 4);
    expect(picked?.id).toBe("b");
  });
  it("picks the least-recently-posted eligible item with no scores", () => {
    const picked = pickNext([
      item("a", "2026-06-03T00:00:00Z"),
      item("b", "2026-06-01T00:00:00Z"),
      item("c", "2026-06-02T00:00:00Z"),
    ], 1);
    expect(picked?.id).toBe("b");
  });
  it("ignores non-approved items", () => {
    const picked = pickNext([item("a", null, "draft"), item("b", "2026-06-01T00:00:00Z")], 4);
    expect(picked?.id).toBe("b");
  });
  it("avoids the most-recent N, falling back to oldest if all are excluded", () => {
    const picked = pickNext([
      item("a", "2026-06-05T00:00:00Z"),
      item("b", "2026-06-04T00:00:00Z"),
    ], 2);
    expect(picked?.id).toBe("b");
  });
  it("exploits the highest engagement score when all have been posted", () => {
    const items = [
      item("a", "2026-06-03T00:00:00Z"),
      item("b", "2026-06-02T00:00:00Z"),
      item("c", "2026-06-01T00:00:00Z"),
    ];
    // c is least-recent (LRU would pick it) but b has the best engagement.
    const picked = pickNext(items, 1, { a: 0.1, b: 0.9, c: 0.5 });
    expect(picked?.id).toBe("b");
  });
});

function visual(id: string, last: string | null, status: VisualItem["status"] = "active"): VisualItem {
  return { id, image_url: `${id}.png`, status, last_used_at: last, times_used: 0 };
}

describe("pickVisual", () => {
  it("returns null when there are no active visuals", () => {
    expect(pickVisual([], 2)).toBeNull();
    expect(pickVisual([visual("a", null, "retired")], 2)).toBeNull();
  });
  it("prefers a never-used visual", () => {
    expect(pickVisual([visual("a", "2026-06-01T00:00:00Z"), visual("b", null)], 2)?.id).toBe("b");
  });
  it("picks least-recently-used and avoids the recent N", () => {
    const picked = pickVisual([
      visual("a", "2026-06-03T00:00:00Z"),
      visual("b", "2026-06-01T00:00:00Z"),
      visual("c", "2026-06-02T00:00:00Z"),
    ], 1);
    expect(picked?.id).toBe("b");
  });
});
