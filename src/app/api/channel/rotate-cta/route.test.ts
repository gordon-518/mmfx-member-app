import { describe, it, expect, vi, beforeEach } from "vitest";

const { adminDbMock } = vi.hoisted(() => ({ adminDbMock: vi.fn() }));
vi.mock("@/lib/channel/db", () => ({ adminDb: adminDbMock }));

import { POST } from "./route";

function req(auth = "Bearer testsecret") {
  return new Request("https://app.test/api/channel/rotate-cta", { method: "POST", headers: { Authorization: auth } });
}

function stubDb({ items, eng, visuals }: { items: unknown[]; eng: unknown[]; visuals: unknown[] }) {
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  let table = "";
  const api = {
    from(t: string) { table = t; return api; },
    select() {
      if (table === "library_engagement") return Promise.resolve({ data: eng });
      return api; // content_library / visual_library: continue to .eq
    },
    eq() {
      if (table === "visual_library") return Promise.resolve({ data: visuals });
      return Promise.resolve({ data: items }); // content_library select .eq("status","approved")
    },
    insert(row: Record<string, unknown>) {
      inserts.push({ table, ...row });
      return Promise.resolve({ error: null });
    },
    update(payload: Record<string, unknown>) {
      const t = table;
      return { eq(_c: string, id: string) { updates.push({ table: t, ...payload, id }); return Promise.resolve({ data: [] }); } };
    },
    _inserts: inserts, _updates: updates,
  };
  return api;
}

beforeEach(() => {
  adminDbMock.mockReset();
  process.env.CRON_SECRET = "testsecret";
});

describe("POST /api/channel/rotate-cta", () => {
  it("401 on bad secret", async () => {
    expect((await POST(req("Bearer no") as never)).status).toBe(401);
  });

  it("no-ops when the pool is empty", async () => {
    adminDbMock.mockReturnValue(stubDb({ items: [], eng: [], visuals: [] }));
    const res = await POST(req() as never);
    expect(await res.json()).toMatchObject({ posted: false });
  });

  it("enqueues the item with a reused visual + buttons and bumps both counters", async () => {
    const item = { id: "lib1", kind: "cta", body: "**hi**", status: "approved",
      button_set: [{ text: "Trial", slug: "signup" }], last_posted_at: null, times_posted: 2 };
    const vis = { id: "vis1", image_url: "https://img/v1.png", status: "active", last_used_at: null, times_used: 4 };
    const db = stubDb({ items: [item], eng: [], visuals: [vis] });
    adminDbMock.mockReturnValue(db);

    const res = await POST(req() as never);
    expect(await res.json()).toMatchObject({ posted: true, item: "lib1", visual: "vis1" });

    const insert = db._inserts[0];
    expect(insert).toMatchObject({ table: "channel_posts", source_id: "lib1", image_url: "https://img/v1.png" });
    expect((insert.button_set as unknown[])[0]).toMatchObject({ slug: "signup" });

    expect(db._updates.some((u) => u.table === "content_library" && u.times_posted === 3)).toBe(true);
    expect(db._updates.some((u) => u.table === "visual_library" && u.times_used === 5)).toBe(true);
  });

  it("posts text-only when the visual pool is empty", async () => {
    const item = { id: "lib1", kind: "cta", body: "hi", status: "approved",
      button_set: null, last_posted_at: null, times_posted: 0 };
    const db = stubDb({ items: [item], eng: [], visuals: [] });
    adminDbMock.mockReturnValue(db);

    const res = await POST(req() as never);
    expect(await res.json()).toMatchObject({ posted: true, visual: null });
    expect(db._inserts[0].image_url).toBeNull();
  });
});
