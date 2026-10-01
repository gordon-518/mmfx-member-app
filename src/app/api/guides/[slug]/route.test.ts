import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { serviceClientMock } = vi.hoisted(() => ({ serviceClientMock: vi.fn() }));
vi.mock("@/lib/journal/api", () => ({ serviceClient: serviceClientMock }));

import { GET } from "./route";
import { guideToRow, type GuideRow } from "@/lib/guides/store";
import { validateGuide } from "@/lib/guides/validate";

const FIXTURES = join(process.cwd(), "src", "lib", "guides", "fixtures");
const GOLD = validateGuide(
  "what-moves-gold",
  JSON.parse(readFileSync(join(FIXTURES, "what-moves-gold.json"), "utf8"))
);

function row(patch: Partial<GuideRow> = {}): GuideRow {
  return {
    ...guideToRow(GOLD),
    status: "published",
    created_at: "2026-09-21T00:00:00.000Z",
    updated_at: "2026-09-21T00:00:00.000Z",
    ...patch,
  };
}

/** A Supabase stub for `.select().eq().eq().maybeSingle()`, recording the filters. */
function stubDb(found: GuideRow | null, error: { message: string } | null = null) {
  const calls: { table?: string; eq: [string, unknown][] } = { eq: [] };
  const builder = {
    eq(col: string, value: unknown) {
      calls.eq.push([col, value]);
      return builder;
    },
    maybeSingle: () => Promise.resolve({ data: error ? null : found, error }),
  };
  return {
    calls,
    from(table: string) {
      calls.table = table;
      return { select: () => builder };
    },
  };
}

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });
const req = (slug: string) => new Request(`https://app.test/api/guides/${slug}`) as never;

const CACHE = "public, s-maxage=300, stale-while-revalidate=3600";

beforeEach(() => {
  serviceClientMock.mockReset();
  process.env.CRON_SECRET = "testsecret";
  delete process.env.ORGANIC_CRON_SECRET;
});

describe("GET /api/guides/[slug]", () => {
  it("needs no auth and returns the guide under the cache header", async () => {
    serviceClientMock.mockReturnValue(stubDb(row()));
    const res = await GET(req("what-moves-gold"), params("what-moves-gold"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(CACHE);
  });

  it("asks for that slug AND a published status", async () => {
    const db = stubDb(row());
    serviceClientMock.mockReturnValue(db);
    await GET(req("what-moves-gold"), params("what-moves-gold"));
    expect(db.calls.table).toBe("guides");
    expect(db.calls.eq).toEqual([
      ["slug", "what-moves-gold"],
      ["status", "published"],
    ]);
  });

  it("returns the v2 object with the contract's own key names", async () => {
    serviceClientMock.mockReturnValue(stubDb(row()));
    const body = await (await GET(req("what-moves-gold"), params("what-moves-gold"))).json();
    // Exactly the keys the site's renderer reads — camelCase, no row columns.
    expect(Object.keys(body).sort()).toEqual([
      "bodyMarkdown",
      "cid",
      "cover",
      "description",
      "feature",
      "h2s",
      "publishedOn",
      "pullQuote",
      "slug",
      "takeaways",
      "title",
      "visuals",
    ]);
    expect(body).toEqual(GOLD);
    // No status, no timestamps, no snake_case — those are the store's business.
    for (const leak of ["status", "updatedAt", "updated_at", "published_on", "body_markdown"]) {
      expect(body[leak]).toBeUndefined();
    }
  });

  it("omits pullQuote when the column is null, rather than sending null", async () => {
    serviceClientMock.mockReturnValue(stubDb(row({ pull_quote: null })));
    const body = await (await GET(req("x"), params("what-moves-gold"))).json();
    expect("pullQuote" in body).toBe(false);
  });

  it("404s an unknown or unpublished slug", async () => {
    serviceClientMock.mockReturnValue(stubDb(null));
    const res = await GET(req("no-such-guide"), params("no-such-guide"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  it("404s a stored row that does not validate — never a 500", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    serviceClientMock.mockReturnValue(stubDb(row({ cover: null })));
    const res = await GET(req("what-moves-gold"), params("what-moves-gold"));
    expect(res.status).toBe(404);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('stored row "what-moves-gold" does not validate'),
      expect.stringContaining("cover must be an object")
    );
    spy.mockRestore();
  });

  it("404s a slug the table could not hold, without touching the database", async () => {
    const db = stubDb(row());
    serviceClientMock.mockReturnValue(db);
    for (const bad of ["Not-Kebab", "has space", "trailing-", "../etc/passwd"]) {
      expect((await GET(req(bad), params(bad))).status).toBe(404);
    }
    expect(db.calls.table).toBeUndefined();
  });

  it("500s only when the query itself fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    serviceClientMock.mockReturnValue(stubDb(null, { message: "connection reset" }));
    const res = await GET(req("what-moves-gold"), params("what-moves-gold"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "read failed" });
    spy.mockRestore();
  });
});
