import { describe, it, expect, vi, beforeEach } from "vitest";

const { adminDbMock, draftMock, dmMock } = vi.hoisted(() => ({
  adminDbMock: vi.fn(), draftMock: vi.fn(), dmMock: vi.fn(),
}));
vi.mock("@/lib/channel/db", () => ({ adminDb: adminDbMock }));
vi.mock("@/lib/channel/draft", () => ({ draftLibraryPosts: draftMock }));
vi.mock("@/lib/channel/sender", () => ({ sendApproverDM: dmMock }));

import { POST } from "./route";

function req(auth = "Bearer testsecret") {
  return new Request("https://app.test/api/channel/replenish-cta", { method: "POST", headers: { Authorization: auth } });
}

function stubDb({ items, eng, inserted }: { items: unknown[]; eng: unknown[]; inserted: unknown[] }) {
  const retires: string[] = [];
  let table = "";
  const api = {
    from(t: string) { table = t; return api; },
    select() {
      if (table === "library_engagement") return Promise.resolve({ data: eng });
      return api; // content_library select → .eq
    },
    eq() { return Promise.resolve({ data: items }); }, // select .eq("status","approved")
    insert() { return { select() { return Promise.resolve({ data: inserted }); } }; },
    update(payload: Record<string, unknown>) {
      return { eq(_c: string, id: string) { if (payload.status === "retired") retires.push(id); return Promise.resolve({ data: [] }); } };
    },
    _retires: retires,
  };
  return api;
}

function approvedItem(id: string) {
  return { id, kind: "educational", body: `body-${id}`, status: "approved", button_set: null, last_posted_at: null, times_posted: 0 };
}

beforeEach(() => {
  adminDbMock.mockReset(); draftMock.mockReset(); dmMock.mockReset();
  process.env.CHANNEL_CRON_SECRET = "testsecret";
});

describe("POST /api/channel/replenish-cta", () => {
  it("401 on bad secret", async () => {
    expect((await POST(req("Bearer no") as never)).status).toBe(401);
  });

  it("does nothing when the pool is already full", async () => {
    const items = Array.from({ length: 12 }, (_, i) => approvedItem(`i${i}`));
    adminDbMock.mockReturnValue(stubDb({ items, eng: [], inserted: [] }));
    const res = await POST(req() as never);
    expect(await res.json()).toMatchObject({ drafted: 0, reason: "pool_ok" });
    expect(draftMock).not.toHaveBeenCalled();
  });

  it("auto-retires a low performer, filters non-compliant drafts, and DMs the rest", async () => {
    const db = stubDb({
      items: [approvedItem("a"), approvedItem("b")],
      eng: [{ item_id: "a", impressions: 10, clicks: 0, reactions: 0 }], // a is a dud
      inserted: [{ id: "d1", kind: "educational", body: "clean post" }],
    });
    adminDbMock.mockReturnValue(db);
    draftMock.mockResolvedValue([
      { kind: "educational", body: "clean post about discipline" },
      { kind: "cta", body: "guaranteed profit" }, // fails lint
    ]);
    dmMock.mockResolvedValue({ ok: true });

    const res = await POST(req() as never);
    const json = await res.json();
    expect(json).toMatchObject({ drafted: 1, retired: 1 });
    expect(db._retires).toContain("a");
    expect(dmMock).toHaveBeenCalledTimes(1);
    expect(dmMock.mock.calls[0][1][0][0].callback_data).toBe("approve:d1");
  });
});
