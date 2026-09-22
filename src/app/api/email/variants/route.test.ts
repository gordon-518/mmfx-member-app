import { describe, it, expect, vi, beforeEach } from "vitest";

const { serviceClientMock } = vi.hoisted(() => ({ serviceClientMock: vi.fn() }));
vi.mock("@/lib/journal/api", () => ({ serviceClient: serviceClientMock }));

import { DELETE, POST } from "./route";

type Row = Record<string, unknown>;

function stubDb() {
  const upserts: { payload: Row; opts: unknown }[] = [];
  const updates: { payload: Row; filters: [string, unknown][] }[] = [];
  return {
    from() {
      return {
        upsert(payload: Row, opts: unknown) {
          upserts.push({ payload, opts });
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: "v1" }, error: null }),
            }),
          };
        },
        update(payload: Row) {
          const filters: [string, unknown][] = [];
          const q = {
            eq(col: string, value: unknown) {
              filters.push([col, value]);
              return q;
            },
            select: () => Promise.resolve({ data: [{ id: "v1" }], error: null }),
          };
          updates.push({ payload, filters });
          return q;
        },
      };
    },
    _upserts: upserts,
    _updates: updates,
  };
}

const COPY = {
  subject: "Your TradingView handle",
  preheader: "One field, and the desk's indicators appear on your charts.",
  paragraphs: ["Add your handle in settings and the indicators show up on your charts."],
  ctaLabel: "Add my handle",
};

function post(body: unknown, auth = "Bearer testsecret") {
  return new Request("https://app.test/api/email/variants", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

function del(qs: string, auth = "Bearer testsecret") {
  return new Request(`https://app.test/api/email/variants${qs}`, {
    method: "DELETE",
    headers: { Authorization: auth },
  }) as never;
}

const GOOD = { flow: "trial", step: "tv", variant_key: "B", copy: COPY, weight: 50 };

beforeEach(() => {
  serviceClientMock.mockReset();
  process.env.CRON_SECRET = "testsecret";
});

describe("POST /api/email/variants", () => {
  it("rejects a bad bearer", async () => {
    expect((await POST(post(GOOD, "Bearer wrong"))).status).toBe(401);
    expect(serviceClientMock).not.toHaveBeenCalled();
  });

  it("upserts an approved challenger on (flow, step, variant_key)", async () => {
    const db = stubDb();
    serviceClientMock.mockReturnValue(db);
    const res = await POST(post({ ...GOOD, rationale: "clearer single action" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: "v1" });
    expect(db._upserts[0].opts).toEqual({ onConflict: "flow,step,variant_key" });
    expect(db._upserts[0].payload).toMatchObject({
      flow: "trial",
      step: "tv",
      variant_key: "B",
      copy: COPY,
      weight: 50,
      active: true,
      created_by: "brain",
      rationale: "clearer single action",
      retired_at: null,
    });
  });

  it("defaults the weight to the agreed 50%", async () => {
    const db = stubDb();
    serviceClientMock.mockReturnValue(db);
    await POST(post({ flow: "trial", step: "tv", variant_key: "B", copy: COPY }));
    expect(db._upserts[0].payload.weight).toBe(50);
  });

  it("refuses a step the rail cannot send", async () => {
    serviceClientMock.mockReturnValue(stubDb());
    const res = await POST(post({ ...GOOD, step: "no-such-step" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("trial/no-such-step");
  });

  it("refuses arm A — the control lives in code, not in the database", async () => {
    serviceClientMock.mockReturnValue(stubDb());
    expect((await POST(post({ ...GOOD, variant_key: "A" }))).status).toBe(400);
  });

  it("refuses a weight outside 0–100", async () => {
    serviceClientMock.mockReturnValue(stubDb());
    expect((await POST(post({ ...GOOD, weight: 140 }))).status).toBe(400);
    expect((await POST(post({ ...GOOD, weight: -1 }))).status).toBe(400);
  });

  it("holds the copy to its limits", async () => {
    serviceClientMock.mockReturnValue(stubDb());
    const cases: [string, unknown][] = [
      ["subject", { ...COPY, subject: "x".repeat(46) }],
      ["preheader", { ...COPY, preheader: "x".repeat(91) }],
      ["ctaLabel", { ...COPY, ctaLabel: "x".repeat(29) }],
      ["paragraphs", { ...COPY, paragraphs: ["a", "b", "c", "d"] }],
      ["paragraphs", { ...COPY, paragraphs: [] }],
      ["paragraphs", { ...COPY, paragraphs: ["ok", 7] }],
      ["subject", { ...COPY, subject: "" }],
    ];
    for (const [field, copy] of cases) {
      const res = await POST(post({ ...GOOD, copy }));
      expect(res.status, field).toBe(400);
      expect((await res.json()).error, field).toContain(field);
    }
  });

  it("lets the digest and the spotlight carry no paragraphs — their body is data", async () => {
    const db = stubDb();
    serviceClientMock.mockReturnValue(db);
    const res = await POST(
      post({ flow: "nurture", step: "digest", variant_key: "B", copy: { ...COPY, paragraphs: [] } })
    );
    expect(res.status).toBe(200);
  });

  it("refuses copy the compliance gate blocks, with the hits", async () => {
    serviceClientMock.mockReturnValue(stubDb());
    const res = await POST(
      post({
        ...GOOD,
        copy: { ...COPY, paragraphs: ["A guaranteed edge on every trade you take."] },
      })
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.verdict).toBe("block");
    expect(body.hits[0]).toMatchObject({ rule: "guaranteed", severity: "block" });
  });

  it("lets copy through that the gate only flags for review", async () => {
    const db = stubDb();
    serviceClientMock.mockReturnValue(db);
    // "delivery" is a review-level hit, not a block: a human already approved
    // this copy in the brain, so review is not a second veto.
    const res = await POST(
      post({ ...GOOD, copy: { ...COPY, paragraphs: ["The delivery of each session is calm."] } })
    );
    expect(res.status).toBe(200);
  });

  it("rejects a body that is not an object", async () => {
    serviceClientMock.mockReturnValue(stubDb());
    expect((await POST(post("nope"))).status).toBe(400);
  });
});

describe("DELETE /api/email/variants", () => {
  it("rejects a bad bearer", async () => {
    expect((await DELETE(del("?flow=trial&step=tv&variant_key=B", "Bearer wrong"))).status).toBe(401);
  });

  it("retires the arm rather than deleting the evidence", async () => {
    const db = stubDb();
    serviceClientMock.mockReturnValue(db);
    const res = await DELETE(del("?flow=trial&step=tv&variant_key=B"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, retired: 1 });
    expect(db._updates[0].payload).toMatchObject({ active: false });
    expect(db._updates[0].payload.retired_at).toEqual(expect.any(String));
    expect(db._updates[0].filters).toEqual([
      ["flow", "trial"],
      ["step", "tv"],
      ["variant_key", "B"],
    ]);
  });

  it("needs all three parts of the key", async () => {
    serviceClientMock.mockReturnValue(stubDb());
    expect((await DELETE(del("?flow=trial&step=tv"))).status).toBe(400);
  });
});
