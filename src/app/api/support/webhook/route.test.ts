import { describe, it, expect, vi, beforeEach } from "vitest";

const { runBurst, handleOutgoing, log } = vi.hoisted(() => ({
  runBurst: vi.fn(async () => ({ kind: "reply" })),
  handleOutgoing: vi.fn(async () => "ignored"),
  log: vi.fn(async () => ({ status: "ok" })),
}));
vi.mock("@/lib/support/run", () => ({ runBurst, handleOutgoing }));
vi.mock("@/lib/support/store", () => ({ supabaseStore: () => ({ log }) }));
vi.mock("@/lib/channel/db", () => ({ adminDb: () => ({}) }));
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (fn: () => unknown) => {
    fn();
  },
}));

import { POST } from "./route";

const URL_BASE = "https://app.test/api/support/webhook";

const req = (body: unknown, key = "k") =>
  new Request(`${URL_BASE}?key=${key}`, { method: "POST", body: JSON.stringify(body) });

const reqNoKey = (body: unknown) =>
  new Request(URL_BASE, { method: "POST", body: JSON.stringify(body) });

const reqRawBody = (rawBody: string, key = "k") =>
  new Request(`${URL_BASE}?key=${key}`, { method: "POST", body: rawBody });

const incoming = {
  title: "incoming_message",
  date: 1789460000,
  contact: { id: "c1", username: "sam", last_message: "hi" },
};

beforeEach(() => {
  process.env.SUPPORT_WEBHOOK_SECRET = "k";
  runBurst.mockClear();
  handleOutgoing.mockClear();
  log.mockReset();
  log.mockResolvedValue({ status: "ok" });
});

describe("POST /api/support/webhook", () => {
  it("rejects a wrong key with 401 and stores nothing", async () => {
    const res = await POST(req([incoming], "nope"));
    expect(res.status).toBe(401);
    expect(log).not.toHaveBeenCalled();
    expect(runBurst).not.toHaveBeenCalled();
  });

  it("rejects a missing key with 401 and stores nothing", async () => {
    const res = await POST(reqNoKey([incoming]));
    expect(res.status).toBe(401);
    expect(log).not.toHaveBeenCalled();
  });

  it("rejects everything when SUPPORT_WEBHOOK_SECRET is unset", async () => {
    delete process.env.SUPPORT_WEBHOOK_SECRET;
    const res = await POST(req([incoming]));
    expect(res.status).toBe(401);
    expect(log).not.toHaveBeenCalled();
  });

  it("stores an incoming message and starts a run", async () => {
    const res = await POST(req([incoming]));
    expect(res.status).toBe(200);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ contact_id: "c1", kind: "incoming", member_text: "hi" })
    );
    expect(runBurst).toHaveBeenCalledWith("c1", {
      at: new Date(1789460000 * 1000).toISOString(),
      text: "hi",
    });
  });

  it("drops a duplicate delivery without calling runBurst", async () => {
    log.mockResolvedValueOnce({ status: "duplicate" });
    const res = await POST(req([incoming]));
    expect(res.status).toBe(200);
    expect(runBurst).not.toHaveBeenCalled();
  });

  it("routes outgoing messages to the quiet-period check, not runBurst", async () => {
    const res = await POST(req([{ title: "outgoing_message", contact: { id: "c1" } }]));
    expect(res.status).toBe(200);
    expect(handleOutgoing).toHaveBeenCalledWith("c1");
    expect(runBurst).not.toHaveBeenCalled();
  });

  it("accepts a single object as well as an array", async () => {
    const res = await POST(req(incoming));
    expect(res.status).toBe(200);
    expect(runBurst).toHaveBeenCalledTimes(1);
  });

  it("returns 200 and schedules nothing for a malformed (non-JSON) body", async () => {
    const res = await POST(reqRawBody("not json at all {"));
    expect(res.status).toBe(200);
    expect(log).not.toHaveBeenCalled();
    expect(runBurst).not.toHaveBeenCalled();
    expect(handleOutgoing).not.toHaveBeenCalled();
  });

  it("returns 200 and schedules nothing for a JSON string body", async () => {
    const res = await POST(req("just a string"));
    expect(res.status).toBe(200);
    expect(runBurst).not.toHaveBeenCalled();
  });

  it("returns 200 and schedules nothing for a null body", async () => {
    const res = await POST(req(null));
    expect(res.status).toBe(200);
    expect(runBurst).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it("skips an event with no contact.id", async () => {
    const res = await POST(
      req([{ title: "incoming_message", date: 123, contact: { username: "sam", last_message: "hi" } }])
    );
    expect(res.status).toBe(200);
    expect(log).not.toHaveBeenCalled();
    expect(runBurst).not.toHaveBeenCalled();
  });

  it("produces the same ISO 'at' for a date in seconds and in milliseconds", async () => {
    const seconds = 1758100000;
    await POST(
      req([{ title: "incoming_message", date: seconds, contact: { id: "c-sec", last_message: "a" } }])
    );
    await POST(
      req([
        {
          title: "incoming_message",
          date: seconds * 1000,
          contact: { id: "c-ms", last_message: "a" },
        },
      ])
    );
    const expected = new Date(seconds * 1000).toISOString();
    expect(runBurst).toHaveBeenNthCalledWith(1, "c-sec", { at: expected, text: "a" });
    expect(runBurst).toHaveBeenNthCalledWith(2, "c-ms", { at: expected, text: "a" });
  });

  it("defaults text to an empty string when last_message is missing", async () => {
    await POST(req([{ title: "incoming_message", date: 111, contact: { id: "c2" } }]));
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ member_text: "" }));
    expect(runBurst).toHaveBeenCalledWith("c2", expect.objectContaining({ text: "" }));
  });

  it("returns 200 and swallows a throw from runBurst inside after()", async () => {
    runBurst.mockRejectedValueOnce(new Error("boom"));
    const res = await POST(req([incoming]));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });
});
