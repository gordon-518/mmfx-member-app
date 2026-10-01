import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { serviceClientMock } = vi.hoisted(() => ({ serviceClientMock: vi.fn() }));
vi.mock("@/lib/journal/api", () => ({ serviceClient: serviceClientMock }));

import { GET } from "./route";
import { guideToRow, type GuideRow } from "@/lib/guides/store";
import { validateGuide } from "@/lib/guides/validate";

const FIXTURES = join(process.cwd(), "src", "lib", "guides", "fixtures");

function live(slug: string) {
  return validateGuide(slug, JSON.parse(readFileSync(join(FIXTURES, `${slug}.json`), "utf8")));
}

const GOLD = live("what-moves-gold");
const BIAS = live("building-a-daily-bias-on-xauusd");

function row(guide = GOLD, patch: Partial<GuideRow> = {}): GuideRow {
  return {
    ...guideToRow(guide),
    status: "published",
    created_at: "2026-09-21T00:00:00.000Z",
    updated_at: "2026-09-21T00:00:00.000Z",
    ...patch,
  };
}

/** A Supabase stub that records the query it was asked for. */
function stubDb(rows: GuideRow[], error: { message: string } | null = null) {
  const calls: { table?: string; columns?: string; eq: [string, unknown][]; order: [string, unknown][] } = {
    eq: [],
    order: [],
  };
  const builder = {
    eq(col: string, value: unknown) {
      calls.eq.push([col, value]);
      return builder;
    },
    order(col: string, opts?: unknown) {
      calls.order.push([col, opts]);
      return builder;
    },
    then(resolve: (r: { data: GuideRow[] | null; error: unknown }) => unknown) {
      return Promise.resolve(resolve({ data: error ? null : rows, error }));
    },
  };
  return {
    calls,
    from(table: string) {
      calls.table = table;
      return {
        select(columns: string) {
          calls.columns = columns;
          return builder;
        },
      };
    },
  };
}

function req(url = "https://app.test/api/guides", auth?: string) {
  return new Request(url, { headers: auth ? { Authorization: auth } : {} }) as never;
}

beforeEach(() => {
  serviceClientMock.mockReset();
  process.env.CRON_SECRET = "testsecret";
  delete process.env.ORGANIC_CRON_SECRET;
});

describe("GET /api/guides", () => {
  it("needs no auth — it is the site's public index", async () => {
    serviceClientMock.mockReturnValue(stubDb([row()]));
    expect((await GET(req())).status).toBe(200);
  });

  it("asks for published rows, newest first, with a stable tie-break", async () => {
    const db = stubDb([row()]);
    serviceClientMock.mockReturnValue(db);
    await GET(req());
    expect(db.calls.table).toBe("guides");
    expect(db.calls.eq).toEqual([["status", "published"]]);
    expect(db.calls.order).toEqual([
      ["published_on", { ascending: false }],
      ["slug", { ascending: true }],
    ]);
  });

  it("returns the six summary keys and nothing else", async () => {
    serviceClientMock.mockReturnValue(stubDb([row()]));
    const body = await (await GET(req())).json();
    expect(body.guides).toHaveLength(1);
    expect(Object.keys(body.guides[0]).sort()).toEqual([
      "cover",
      "description",
      "feature",
      "publishedOn",
      "slug",
      "title",
    ]);
    expect(body.guides[0].slug).toBe("what-moves-gold");
    // The body is NOT in a summary: the index card never shows it.
    expect(body.guides[0].bodyMarkdown).toBeUndefined();
  });

  it("keeps the order the database gave it", async () => {
    serviceClientMock.mockReturnValue(stubDb([row(BIAS), row(GOLD)]));
    const body = await (await GET(req())).json();
    expect(body.guides.map((g: { slug: string }) => g.slug)).toEqual([
      "building-a-daily-bias-on-xauusd",
      "what-moves-gold",
    ]);
  });

  it("sends the cache header the design doc specifies, verbatim", async () => {
    serviceClientMock.mockReturnValue(stubDb([row()]));
    expect((await GET(req())).headers.get("Cache-Control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=3600"
    );
  });

  it("skips a row that does not validate rather than failing the index", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    serviceClientMock.mockReturnValue(stubDb([row(GOLD, { takeaways: [] }), row(BIAS)]));
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.guides.map((g: { slug: string }) => g.slug)).toEqual([
      "building-a-daily-bias-on-xauusd",
    ]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("returns an empty list, not a 404, when nothing is published", async () => {
    serviceClientMock.mockReturnValue(stubDb([]));
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ guides: [] });
  });

  it("500s only when the query itself fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    serviceClientMock.mockReturnValue(stubDb([], { message: "connection reset" }));
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "list failed" });
    spy.mockRestore();
  });
});
