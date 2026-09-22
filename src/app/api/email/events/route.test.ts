import { describe, it, expect, vi, beforeEach } from "vitest";

const { serviceClientMock } = vi.hoisted(() => ({ serviceClientMock: vi.fn() }));
vi.mock("@/lib/journal/api", () => ({ serviceClient: serviceClientMock }));

import { POST, normalizeEvent } from "./route";

type Row = Record<string, unknown>;
interface Filter {
  op: string;
  col: string;
  value: unknown;
}

/**
 * A chainable Supabase stub. `rows(table, filters)` answers every select; every
 * upsert is recorded, and `inserted` is what the upsert reports back (which is
 * how ignoreDuplicates surfaces a duplicate: fewer rows out than in).
 */
function stubDb(
  rows: (table: string, filters: Filter[]) => Row[],
  inserted?: (payload: Row[]) => Row[]
) {
  const upserts: { table: string; payload: Row[]; opts: unknown }[] = [];
  const selects: { table: string; filters: Filter[] }[] = [];

  function from(table: string) {
    const filters: Filter[] = [];
    const q = {
      select: () => q,
      eq: (col: string, value: unknown) => (filters.push({ op: "eq", col, value }), q),
      in: (col: string, value: unknown) => (filters.push({ op: "in", col, value }), q),
      gte: (col: string, value: unknown) => (filters.push({ op: "gte", col, value }), q),
      lte: (col: string, value: unknown) => (filters.push({ op: "lte", col, value }), q),
      order: () => q,
      limit: () => {
        selects.push({ table, filters });
        return Promise.resolve({ data: rows(table, filters), error: null });
      },
      then: (resolve: (v: { data: Row[]; error: null }) => unknown) => {
        selects.push({ table, filters });
        return Promise.resolve({ data: rows(table, filters), error: null }).then(resolve);
      },
      upsert: (payload: Row[], opts: unknown) => {
        upserts.push({ table, payload, opts });
        return {
          select: () =>
            Promise.resolve({ data: inserted ? inserted(payload) : payload, error: null }),
        };
      },
    };
    return q;
  }

  return { from, _upserts: upserts, _selects: selects };
}

const SENT_AT = "2026-09-22T09:00:00.000Z";
const TS = Math.floor(Date.parse("2026-09-22T09:04:00.000Z") / 1000);

function req(body: unknown, k: string | null = "shh", raw?: string) {
  const url = `https://app.test/api/email/events${k === null ? "" : `?k=${k}`}`;
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ?? JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  serviceClientMock.mockReset();
  process.env.EMAIL_EVENTS_SECRET = "shh";
});

describe("POST /api/email/events — the door", () => {
  it("rejects a request without the secret", async () => {
    const res = await POST(req([{ event: "delivered" }], null));
    expect(res.status).toBe(401);
    expect(serviceClientMock).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret", async () => {
    expect((await POST(req([{ event: "delivered" }], "nope"))).status).toBe(401);
    expect(serviceClientMock).not.toHaveBeenCalled();
  });

  it("stays shut when EMAIL_EVENTS_SECRET is not configured", async () => {
    delete process.env.EMAIL_EVENTS_SECRET;
    expect((await POST(req([{ event: "delivered" }], "shh"))).status).toBe(401);
  });

  it("answers 200 to malformed JSON — SendPulse documents no retries", async () => {
    const db = stubDb(() => []);
    serviceClientMock.mockReturnValue(db);
    const res = await POST(req(null, "shh", "{not json"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: 0, matched: 0, ignored: 1 });
    expect(db._upserts).toEqual([]);
  });
});

describe("POST /api/email/events — matching", () => {
  it("takes an array and joins both events on provider_id", async () => {
    const db = stubDb((table) =>
      table === "email_sends" ? [{ id: "send-1", provider_id: "tlr7m5-1bve4z-ik" }] : []
    );
    serviceClientMock.mockReturnValue(db);

    const res = await POST(
      req([
        {
          event: "delivered",
          timestamp: TS,
          message_id: "tlr7m5-1bve4z-ik",
          recipient: "wei@example.com",
          subject: "Welcome in",
        },
        {
          event: "opened",
          timestamp: TS + 60,
          message_id: "tlr7m5-1bve4z-ik",
          recipient: "wei@example.com",
          subject: "Welcome in",
        },
      ])
    );

    expect(await res.json()).toEqual({ received: 2, matched: 2, ignored: 0 });
    expect(db._upserts).toHaveLength(1);
    const payload = db._upserts[0].payload;
    expect(payload).toHaveLength(2);
    expect(payload[0]).toMatchObject({
      send_id: "send-1",
      provider_id: "tlr7m5-1bve4z-ik",
      event: "delivered",
      occurred_at: "2026-09-22T09:04:00.000Z",
    });
    expect(payload[1]).toMatchObject({ event: "opened", send_id: "send-1" });
    // One lookup for the whole batch, not one per event.
    expect(db._selects.filter((s) => s.table === "email_sends")).toHaveLength(1);
  });

  it("accepts a bare object as well as an array", async () => {
    const db = stubDb(() => []);
    serviceClientMock.mockReturnValue(db);
    const res = await POST(req({ event: "delivered", timestamp: TS, message_id: "x" }));
    expect(await res.json()).toEqual({ received: 1, matched: 0, ignored: 0 });
  });

  it("stringifies a numeric message_id before matching", async () => {
    const db = stubDb((table) =>
      table === "email_sends" ? [{ id: "send-9", provider_id: "481516" }] : []
    );
    serviceClientMock.mockReturnValue(db);
    await POST(req([{ event: "delivered", timestamp: TS, message_id: 481516 }]));
    expect(db._upserts[0].payload[0]).toMatchObject({ send_id: "send-9", provider_id: "481516" });
  });

  it("falls back to recipient + subject + a day either side when the id is unknown", async () => {
    const db = stubDb((table, filters) => {
      if (table === "profiles") return [{ id: "u1", email: "wei@example.com" }];
      // The provider_id sweep finds nothing; the fallback, filtered by user
      // and subject, finds the send.
      const byUser = filters.some((f) => f.col === "user_id");
      return table === "email_sends" && byUser ? [{ id: "send-7", sent_at: SENT_AT }] : [];
    });
    serviceClientMock.mockReturnValue(db);

    const res = await POST(
      req([
        {
          event: "clicked",
          timestamp: TS,
          message_id: 99999,
          recipient: "wei@example.com",
          subject: "Welcome in",
          url: "https://app.marketmakersfx.net/daily-analysis?cid=EML-trial-welcome",
        },
      ])
    );

    expect(await res.json()).toEqual({ received: 1, matched: 1, ignored: 0 });
    expect(db._upserts[0].payload[0]).toMatchObject({
      send_id: "send-7",
      provider_id: "99999",
      event: "clicked",
      url: "https://app.marketmakersfx.net/daily-analysis?cid=EML-trial-welcome",
    });

    const fallback = db._selects.find(
      (s) => s.table === "email_sends" && s.filters.some((f) => f.col === "user_id")
    )!;
    expect(fallback.filters).toContainEqual({ op: "eq", col: "subject", value: "Welcome in" });
    expect(fallback.filters).toContainEqual({
      op: "gte",
      col: "sent_at",
      value: new Date((TS - 86400) * 1000).toISOString(),
    });
    expect(fallback.filters).toContainEqual({
      op: "lte",
      col: "sent_at",
      value: new Date((TS + 86400) * 1000).toISOString(),
    });
  });

  it("stores an unmatched event anyway — the raw payload is still evidence", async () => {
    const db = stubDb(() => []);
    serviceClientMock.mockReturnValue(db);
    const res = await POST(
      req([{ event: "hard_bounce", timestamp: TS, message_id: "gone", recipient: "x@y.z" }])
    );
    expect(await res.json()).toEqual({ received: 1, matched: 0, ignored: 0 });
    expect(db._upserts[0].payload[0]).toMatchObject({ send_id: null, event: "hard_bounce" });
    expect(db._upserts[0].payload[0].raw).toMatchObject({ event: "hard_bounce" });
  });
});

describe("POST /api/email/events — the events themselves", () => {
  it("maps every SendPulse spelling onto the nine stored names", () => {
    expect(normalizeEvent("delivered")).toBe("delivered");
    expect(normalizeEvent("not delivered")).toBe("undelivered");
    expect(normalizeEvent("Undelivered")).toBe("undelivered");
    expect(normalizeEvent("open")).toBe("opened");
    expect(normalizeEvent("click")).toBe("clicked");
    expect(normalizeEvent("marked as spam")).toBe("spam");
    expect(normalizeEvent("unsubscribe")).toBe("unsubscribed");
    expect(normalizeEvent("resubscribe")).toBe("resubscribed");
    expect(normalizeEvent("hard bounce")).toBe("hard_bounce");
    expect(normalizeEvent("soft_bounce")).toBe("soft_bounce");
  });

  it("ignores an event name it does not know rather than guessing", async () => {
    expect(normalizeEvent("teleported")).toBeNull();
    const db = stubDb(() => []);
    serviceClientMock.mockReturnValue(db);
    const res = await POST(req([{ event: "teleported", timestamp: TS, message_id: "a" }]));
    expect(await res.json()).toEqual({ received: 1, matched: 0, ignored: 1 });
    expect(db._upserts).toEqual([]);
  });

  it("uses the arrival time when an event carries no timestamp", async () => {
    const db = stubDb(() => []);
    serviceClientMock.mockReturnValue(db);
    const before = Date.now();
    await POST(req([{ event: "unsubscribed", message_id: "a", recipient: "x@y.z" }]));
    const at = Date.parse(String(db._upserts[0].payload[0].occurred_at));
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
  });

  it("keeps the clicked URL and leaves it null on every other event", async () => {
    const db = stubDb(() => []);
    serviceClientMock.mockReturnValue(db);
    await POST(
      req([
        { event: "clicked", timestamp: TS, message_id: "a", url: "https://app.test/x" },
        { event: "opened", timestamp: TS, message_id: "a" },
      ])
    );
    expect(db._upserts[0].payload[0].url).toBe("https://app.test/x");
    expect(db._upserts[0].payload[1].url).toBeNull();
  });
});

describe("POST /api/email/events — idempotency", () => {
  it("upserts on the unique key and ignores duplicates", async () => {
    const db = stubDb(() => []);
    serviceClientMock.mockReturnValue(db);
    await POST(req([{ event: "delivered", timestamp: TS, message_id: "a" }]));
    expect(db._upserts[0].opts).toEqual({
      onConflict: "provider_id,event,occurred_at",
      ignoreDuplicates: true,
    });
  });

  it("counts a re-posted batch as ignored, and still answers 200", async () => {
    // SendPulse re-sends a batch: nothing new is written.
    const db = stubDb(
      () => [],
      () => []
    );
    serviceClientMock.mockReturnValue(db);
    const res = await POST(
      req([
        { event: "delivered", timestamp: TS, message_id: "a" },
        { event: "opened", timestamp: TS, message_id: "a" },
      ])
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: 2, matched: 0, ignored: 2 });
  });

  it("drops a duplicate inside one batch before it reaches the database", async () => {
    const db = stubDb(() => []);
    serviceClientMock.mockReturnValue(db);
    const one = { event: "delivered", timestamp: TS, message_id: "a" };
    const res = await POST(req([one, one]));
    expect(db._upserts[0].payload).toHaveLength(1);
    expect(await res.json()).toEqual({ received: 2, matched: 0, ignored: 1 });
  });

  it("never 500s: a write that fails is reported as ignored", async () => {
    serviceClientMock.mockReturnValue({
      from: () => ({
        select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }),
        upsert: () => ({ select: () => Promise.resolve({ data: null, error: { message: "boom" } }) }),
      }),
    });
    const res = await POST(req([{ event: "delivered", timestamp: TS, message_id: "a" }]));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: 1, matched: 0, ignored: 1 });
  });
});
