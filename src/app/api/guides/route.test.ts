import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { serviceClientMock } = vi.hoisted(() => ({ serviceClientMock: vi.fn() }));
vi.mock("@/lib/journal/api", () => ({ serviceClient: serviceClientMock }));

import { GET, POST } from "./route";
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

/* ===== POST ============================================================== */

/** A Supabase stub for `.upsert()`, recording the payload and the conflict target. */
function stubUpsert(error: { message: string } | null = null) {
  const calls: { table?: string; payload?: Record<string, unknown>; options?: unknown } = {};
  return {
    calls,
    from(table: string) {
      calls.table = table;
      return {
        upsert(payload: Record<string, unknown>, options?: unknown) {
          calls.payload = payload;
          calls.options = options;
          return Promise.resolve({ error });
        },
      };
    },
  };
}

function post(body: unknown, auth = "Bearer testsecret") {
  return new Request("https://app.test/api/guides", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as never;
}

describe("POST /api/guides", () => {
  it("rejects a bad secret with 401, before any database call", async () => {
    const db = stubUpsert();
    serviceClientMock.mockReturnValue(db);
    expect((await POST(post(GOLD, "Bearer wrong"))).status).toBe(401);
    expect((await POST(post(GOLD, ""))).status).toBe(401);
    expect(serviceClientMock).not.toHaveBeenCalled();
  });

  it("accepts ORGANIC_CRON_SECRET in preference to CRON_SECRET", async () => {
    process.env.ORGANIC_CRON_SECRET = "organicsecret";
    serviceClientMock.mockReturnValue(stubUpsert());
    expect((await POST(post(GOLD, "Bearer organicsecret"))).status).toBe(200);
    expect((await POST(post(GOLD, "Bearer testsecret"))).status).toBe(401);
  });

  it("stores the guide and answers with the live URL", async () => {
    const db = stubUpsert();
    serviceClientMock.mockReturnValue(db);
    const res = await POST(post(GOLD));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      slug: "what-moves-gold",
      url: "https://marketmakersfx.net/guides/what-moves-gold",
    });
  });

  it("writes the snake_case columns, published, upserting on the slug", async () => {
    const db = stubUpsert();
    serviceClientMock.mockReturnValue(db);
    await POST(post(GOLD));
    expect(db.calls.table).toBe("guides");
    expect(db.calls.options).toEqual({ onConflict: "slug" });
    expect(db.calls.payload).toMatchObject({
      slug: "what-moves-gold",
      feature: GOLD.feature,
      published_on: GOLD.publishedOn,
      body_markdown: GOLD.bodyMarkdown,
      status: "published",
    });
    // POSTing is how an unpublished guide comes back, so status is always set.
    expect(db.calls.payload!.status).toBe("published");
  });

  it("re-POSTing a slug corrects it in place rather than adding a second row", async () => {
    const db = stubUpsert();
    serviceClientMock.mockReturnValue(db);
    await POST(post({ ...GOLD, title: "What moves gold, revised" }));
    expect(db.calls.options).toEqual({ onConflict: "slug" });
    expect(db.calls.payload!.title).toBe("What moves gold, revised");
  });

  it("422s a body that breaks the contract, with the error list, and stores nothing", async () => {
    const db = stubUpsert();
    serviceClientMock.mockReturnValue(db);
    const res = await POST(post({ ...GOLD, takeaways: [] }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toContain('Invalid guide "what-moves-gold"');
    expect(body.errors[0]).toContain("takeaways has 0 entries");
    expect(db.calls.payload).toBeUndefined();
  });

  it("422s the rules the site would fail the build on", async () => {
    serviceClientMock.mockReturnValue(stubUpsert());
    const cases: [string, unknown][] = [
      ["h2s out of order", { ...GOLD, h2s: [...GOLD.h2s].reverse() }],
      ["a feature the site has no page for", { ...GOLD, feature: "course" }],
      ["a markdown takeaway", { ...GOLD, takeaways: ["A **strong** claim.", "Two.", "Three."] }],
      ["a cid from the wrong family", { ...GOLD, cid: "ORG-spotlight" }],
      ["an unknown top-level field", { ...GOLD, author: "Gordon" }],
      ["no cover", { ...GOLD, cover: undefined }],
    ];
    for (const [, body] of cases) {
      expect((await POST(post(body))).status).toBe(422);
    }
  });

  it("422s a body that is not a JSON object, including unparseable JSON", async () => {
    serviceClientMock.mockReturnValue(stubUpsert());
    for (const body of ["not json at all", "[]", '"a string"', "null"]) {
      const res = await POST(post(body));
      expect(res.status).toBe(422);
      expect((await res.json()).errors).toHaveLength(1);
    }
  });

  it("500s when the upsert itself fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    serviceClientMock.mockReturnValue(stubUpsert({ message: "deadlock detected" }));
    const res = await POST(post(GOLD));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "upsert failed" });
    spy.mockRestore();
  });

  it("accepts all three live guides unchanged", async () => {
    serviceClientMock.mockReturnValue(stubUpsert());
    for (const slug of [
      "what-moves-gold",
      "building-a-daily-bias-on-xauusd",
      "reading-market-structure-a-practical-framework",
    ]) {
      const raw = JSON.parse(readFileSync(join(FIXTURES, `${slug}.json`), "utf8"));
      const res = await POST(post(raw));
      expect(res.status, slug).toBe(200);
      expect(await res.json()).toEqual({ slug, url: `https://marketmakersfx.net/guides/${slug}` });
    }
  });
});

/* ===== GET ?format=export ================================================ */

describe("GET /api/guides?format=export", () => {
  const url = "https://app.test/api/guides?format=export";

  it("needs the bearer — without it, it is not the public index either", async () => {
    const db = stubDb([row()]);
    serviceClientMock.mockReturnValue(db);
    const res = await GET(req(url));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(serviceClientMock).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret", async () => {
    serviceClientMock.mockReturnValue(stubDb([row()]));
    expect((await GET(req(url, "Bearer wrong"))).status).toBe(401);
  });

  it("accepts ORGANIC_CRON_SECRET in preference to CRON_SECRET", async () => {
    process.env.ORGANIC_CRON_SECRET = "organicsecret";
    serviceClientMock.mockReturnValue(stubDb([row()]));
    expect((await GET(req(url, "Bearer organicsecret"))).status).toBe(200);
    expect((await GET(req(url, "Bearer testsecret"))).status).toBe(401);
  });

  it("does NOT filter on status — the backup carries both", async () => {
    const db = stubDb([row(GOLD, { status: "unpublished" }), row(BIAS)]);
    serviceClientMock.mockReturnValue(db);
    const res = await GET(req(url, "Bearer testsecret"));
    expect(res.status).toBe(200);
    expect(db.calls.eq).toEqual([]);
    expect(db.calls.order).toEqual([
      ["published_on", { ascending: false }],
      ["slug", { ascending: true }],
    ]);
    const body = await res.json();
    expect(body.guides.map((g: { status: string }) => g.status)).toEqual([
      "unpublished",
      "published",
    ]);
  });

  it("returns full objects plus status and updatedAt", async () => {
    serviceClientMock.mockReturnValue(
      stubDb([row(GOLD, { updated_at: "2026-10-01T09:00:00.000Z" })])
    );
    const body = await (await GET(req(url, "Bearer testsecret"))).json();
    expect(Object.keys(body.guides[0]).sort()).toEqual([
      "bodyMarkdown",
      "cid",
      "cover",
      "description",
      "feature",
      "h2s",
      "publishedOn",
      "pullQuote",
      "slug",
      "status",
      "takeaways",
      "title",
      "updatedAt",
      "visuals",
    ]);
    expect(body.guides[0].updatedAt).toBe("2026-10-01T09:00:00.000Z");
    expect(body.guides[0].bodyMarkdown).toBe(GOLD.bodyMarkdown);
  });

  it("is never cached — a backup reads the database, not a CDN copy of it", async () => {
    serviceClientMock.mockReturnValue(stubDb([row()]));
    expect((await GET(req(url, "Bearer testsecret"))).headers.get("Cache-Control")).toBe("no-store");
  });

  it("keeps a row that does not validate, unlike the public list", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    serviceClientMock.mockReturnValue(stubDb([row(GOLD, { takeaways: [] })]));
    const body = await (await GET(req(url, "Bearer testsecret"))).json();
    expect(body.guides).toHaveLength(1);
    expect(body.guides[0].slug).toBe("what-moves-gold");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("exporting an invalid row"));
    spy.mockRestore();
  });

  it("500s with its own message when the query fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    serviceClientMock.mockReturnValue(stubDb([], { message: "connection reset" }));
    const res = await GET(req(url, "Bearer testsecret"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "export failed" });
    spy.mockRestore();
  });

  it("leaves any other format value as the public index", async () => {
    // Only the exact value switches endpoints; ?format=json is the index.
    serviceClientMock.mockReturnValue(stubDb([row()]));
    const res = await GET(req("https://app.test/api/guides?format=json"));
    expect(res.status).toBe(200);
    expect((await res.json()).guides[0].bodyMarkdown).toBeUndefined();
  });
});
