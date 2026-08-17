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

function stubDb({ items, eng, inserted, backlog = 0 }: {
  items: unknown[]; eng: unknown[]; inserted: unknown[]; backlog?: number;
}) {
  const retires: string[] = [];
  const insertedRows: Record<string, unknown>[] = [];
  let table = "";
  const api = {
    from(t: string) { table = t; return api; },
    select(_cols?: string, opts?: { head?: boolean }) {
      // head+count is the draft-backlog probe
      if (opts?.head) return { eq() { return Promise.resolve({ count: backlog }); } };
      if (table === "library_engagement") return Promise.resolve({ data: eng });
      return api; // content_library select → .eq
    },
    eq() { return Promise.resolve({ data: items }); }, // select .eq("status","approved")
    insert(rows: Record<string, unknown>[]) {
      insertedRows.push(...(Array.isArray(rows) ? rows : [rows]));
      return { select() { return Promise.resolve({ data: inserted }); } };
    },
    update(payload: Record<string, unknown>) {
      return { eq(_c: string, id: string) { if (payload.status === "retired") retires.push(id); return Promise.resolve({ data: [] }); } };
    },
    _retires: retires,
    _inserted: insertedRows,
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
    expect(await res.json()).toMatchObject({ drafted: 0 });
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

describe("replenish-cta — the learning loop", () => {
  const approved = (id: string, slug: string, weight: number) => ({
    id, kind: "cta", body: `body-${id}`, status: "approved",
    button_set: [{ text: "Go", slug }], weight, last_posted_at: null, times_posted: 0,
  });

  it("drafts from proven winners even when the pool is healthy", async () => {
    // 14 approved (pool is fine) but one post has real evidence behind it.
    const items = [
      approved("win", "journal", 4),
      ...Array.from({ length: 13 }, (_, i) => approved(`p${i}`, "news", 1)),
    ];
    const db = stubDb({
      items,
      eng: [{ item_id: "win", impressions: 10, clicks: 5, reactions: 1 }],
      inserted: [{ id: "n1", kind: "cta", body: "fresh" }],
    });
    adminDbMock.mockReturnValue(db);
    draftMock.mockResolvedValue([{ kind: "cta", body: "clean new copy" }]);
    dmMock.mockResolvedValue({ ok: true });

    const res = await POST(req() as never);
    expect(await res.json()).toMatchObject({ drafted: 1 });

    // the winner's numbers reached the model
    const winners = draftMock.mock.calls[0][1];
    expect(winners[0]).toMatchObject({ feature: "journal", impressions: 10, clicks: 5 });

    // and the new draft inherited that winner's targeting + weight
    expect(db._inserted[0]).toMatchObject({ weight: 4 });
    expect((db._inserted[0].button_set as { slug: string }[])[0].slug).toBe("journal");
  });

  it("ignores a lucky post that has barely run", async () => {
    const db = stubDb({
      items: [approved("fluke", "news", 1)],
      eng: [{ item_id: "fluke", impressions: 1, clicks: 1, reactions: 0 }], // 100% on one post
      inserted: [],
    });
    adminDbMock.mockReturnValue(db);
    draftMock.mockResolvedValue([]);
    const res = await POST(req() as never);
    // pool is low so it still drafts, but the fluke must not be used as a model
    const winners = draftMock.mock.calls[0]?.[1] ?? [];
    expect(winners).toHaveLength(0);
    expect(res.status).toBe(200);
  });

  it("holds off when the approver already has a backlog of drafts", async () => {
    const items = Array.from({ length: 14 }, (_, i) => approved(`p${i}`, "news", 2));
    const db = stubDb({
      items,
      eng: [{ item_id: "p0", impressions: 8, clicks: 3, reactions: 0 }],
      inserted: [],
      backlog: 6,
    });
    adminDbMock.mockReturnValue(db);
    const res = await POST(req() as never);
    expect(await res.json()).toMatchObject({ drafted: 0, reason: "backlog_full" });
    expect(draftMock).not.toHaveBeenCalled();
  });
});
