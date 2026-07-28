import { describe, it, expect, vi, beforeEach } from "vitest";

const { adminDbMock } = vi.hoisted(() => ({ adminDbMock: vi.fn() }));
vi.mock("@/lib/channel/db", () => ({ adminDb: adminDbMock }));

import { POST } from "./route";

function req(auth = "Bearer testsecret") {
  return new Request("https://app.test/api/channel/rotate-cta", { method: "POST", headers: { Authorization: auth } });
}

function stubDb({ items, eng }: { items: unknown[]; eng: unknown[] }) {
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  let table = "";
  const api = {
    from(t: string) { table = t; return api; },
    select() {
      if (table === "library_engagement") return Promise.resolve({ data: eng });
      return api; // content_library: continues to .eq
    },
    eq() { return Promise.resolve({ data: items }); }, // content_library select .eq("status","approved")
    insert(row: Record<string, unknown>) {
      inserts.push({ table, ...row });
      return Promise.resolve({ error: null });
    },
    update(payload: Record<string, unknown>) {
      return { eq(_c: string, id: string) { updates.push({ ...payload, id }); return Promise.resolve({ data: [] }); } };
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
    adminDbMock.mockReturnValue(stubDb({ items: [], eng: [] }));
    const res = await POST(req() as never);
    expect(await res.json()).toMatchObject({ posted: false });
  });

  it("enqueues the picked item with its button set and bumps its counters", async () => {
    const item = { id: "lib1", kind: "cta", body: "**hi**", status: "approved",
      button_set: [{ text: "Trial", slug: "signup" }], last_posted_at: null, times_posted: 2 };
    const db = stubDb({ items: [item], eng: [] });
    adminDbMock.mockReturnValue(db);
    const res = await POST(req() as never);
    expect(await res.json()).toMatchObject({ posted: true, item: "lib1" });
    expect(db._inserts[0]).toMatchObject({ table: "channel_posts", kind: "library", source_id: "lib1" });
    expect((db._inserts[0].button_set as unknown[])[0]).toMatchObject({ slug: "signup" });
    expect(db._updates[0]).toMatchObject({ times_posted: 3 });
  });
});
