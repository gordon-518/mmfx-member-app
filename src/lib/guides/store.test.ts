import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  GUIDE_COLUMNS,
  guideToRow,
  guideUrl,
  rowToExport,
  rowToGuide,
  type GuideRow,
} from "./store";
import { validateGuide, type GuideV2 } from "./validate";

const LIVE: GuideV2 = validateGuide(
  "what-moves-gold",
  JSON.parse(readFileSync(join(__dirname, "fixtures", "what-moves-gold.json"), "utf8"))
);

/** The live guide as the table would hold it. */
function row(patch: Partial<GuideRow> = {}): GuideRow {
  return {
    ...guideToRow(LIVE),
    status: "published",
    created_at: "2026-09-21T00:00:00.000Z",
    updated_at: "2026-09-21T00:00:00.000Z",
    ...patch,
  };
}

describe("the column list", () => {
  it("names every column the mapping reads", () => {
    for (const col of [
      "slug", "feature", "title", "description", "published_on", "cid", "h2s",
      "body_markdown", "takeaways", "pull_quote", "cover", "visuals", "status",
      "created_at", "updated_at",
    ]) {
      expect(GUIDE_COLUMNS.split(", ")).toContain(col);
    }
  });
});

describe("guideUrl", () => {
  it("points at the marketing site, not this app", () => {
    expect(guideUrl("what-moves-gold")).toBe("https://marketmakersfx.net/guides/what-moves-gold");
  });
});

describe("the round trip", () => {
  it("survives guide → row → guide unchanged", () => {
    expect(rowToGuide(row())).toEqual(LIVE);
  });

  it("maps every snake_case column to its contract key", () => {
    const r = guideToRow(LIVE);
    expect(r.published_on).toBe(LIVE.publishedOn);
    expect(r.body_markdown).toBe(LIVE.bodyMarkdown);
    expect(r.h2s).toEqual(LIVE.h2s);
    expect(r.cover).toEqual(LIVE.cover);
    expect(r.visuals).toEqual(LIVE.visuals);
    // The row carries no status/created_at/updated_at — those are the route's.
    expect(Object.keys(r)).not.toContain("status");
  });

  it("writes a missing pull quote as null and reads a null back as absent", () => {
    const { pullQuote: _drop, ...noQuote } = LIVE;
    void _drop;
    expect(guideToRow(noQuote as GuideV2).pull_quote).toBeNull();
    const g = rowToGuide(row({ pull_quote: null }))!;
    expect("pullQuote" in g).toBe(false);
  });
});

describe("rowToGuide on a row that does not validate", () => {
  it("returns null and logs the slug and the reason", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    // visuals emptied — a write that went round the route, or a limit that
    // moved after the row was stored.
    expect(rowToGuide(row({ visuals: [] }))).toBeNull();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('stored row "what-moves-gold" does not validate'),
      expect.stringContaining("visuals has 0 entries")
    );
    spy.mockRestore();
  });

  it.each([
    ["a null jsonb column", { cover: null }],
    ["a feature the site dropped", { feature: "retired-tool" }],
    ["h2s out of step with the body", { h2s: ["Nope"] }],
    ["a takeaway past its limit", { takeaways: ["a".repeat(141), "Two.", "Three."] }],
  ])("returns null for %s", (_name, patch) => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(rowToGuide(row(patch as Partial<GuideRow>))).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("rowToExport", () => {
  it("carries the full object plus status and updatedAt", () => {
    const e = rowToExport(row({ status: "unpublished", updated_at: "2026-10-01T09:00:00.000Z" }));
    expect(e.status).toBe("unpublished");
    expect(e.updatedAt).toBe("2026-10-01T09:00:00.000Z");
    expect(e.slug).toBe("what-moves-gold");
    expect(e.bodyMarkdown).toBe(LIVE.bodyMarkdown);
    expect(e.publishedOn).toBe(LIVE.publishedOn);
  });

  it("exports an invalid row anyway, and logs it", () => {
    // A backup that silently omits the one broken row is the worst backup
    // there is — so the export keeps it, unlike the public reads.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const e = rowToExport(row({ visuals: [] }));
    expect(e.visuals).toEqual([]);
    expect(e.slug).toBe("what-moves-gold");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("exporting an invalid row"));
    spy.mockRestore();
  });

  it("leaks no snake_case key into the export", () => {
    const e = rowToExport(row());
    for (const key of Object.keys(e)) expect(key).not.toMatch(/_/);
  });
});
