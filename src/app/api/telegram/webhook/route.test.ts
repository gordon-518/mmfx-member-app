import { describe, it, expect, vi, beforeEach } from "vitest";

const { adminDbMock } = vi.hoisted(() => ({ adminDbMock: vi.fn() }));
vi.mock("@/lib/channel/db", () => ({ adminDb: adminDbMock }));

import { POST } from "./route";

function req(body: unknown, secret = "hook") {
  return new Request("https://app.test/api/telegram/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-telegram-bot-api-secret-token": secret },
    body: JSON.stringify(body),
  });
}

function stubDb() {
  const calls: { table: string; payload: Record<string, unknown>; id: string }[] = [];
  const api = {
    _t: "",
    from(table: string) { api._t = table; return api; },
    update(payload: Record<string, unknown>) {
      return { eq(_c: string, id: string) { calls.push({ table: api._t, payload, id }); return Promise.resolve({ data: [] }); } };
    },
    _calls: calls,
  };
  return api;
}

beforeEach(() => {
  adminDbMock.mockReset();
  process.env.TELEGRAM_WEBHOOK_SECRET = "hook";
  process.env.CHANNEL_BOT_TOKEN = "T";
  process.env.APPROVER_CHAT_ID = "555";
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});

describe("POST /api/telegram/webhook", () => {
  it("rejects a wrong secret token with 401", async () => {
    const res = await POST(req({}, "nope") as never);
    expect(res.status).toBe(401);
  });

  it("approve callback from the approver flips the library item to approved", async () => {
    const db = stubDb(); adminDbMock.mockReturnValue(db);
    const res = await POST(req({ callback_query: { id: "cb1", from: { id: 555 }, data: "approve:lib-9" } }) as never);
    expect(res.status).toBe(200);
    expect(db._calls[0]).toMatchObject({ table: "content_library", id: "lib-9" });
    expect(db._calls[0].payload.status).toBe("approved");
  });

  it("skip callback from the approver retires the item", async () => {
    const db = stubDb(); adminDbMock.mockReturnValue(db);
    await POST(req({ callback_query: { id: "cb2", from: { id: 555 }, data: "skip:lib-3" } }) as never);
    expect(db._calls[0].payload.status).toBe("retired");
  });

  it("ignores an approve tap from someone who is not the approver", async () => {
    const db = stubDb(); adminDbMock.mockReturnValue(db);
    const res = await POST(req({ callback_query: { id: "cb3", from: { id: 999 }, data: "approve:lib-9" } }) as never);
    expect(res.status).toBe(200);
    expect(db._calls).toHaveLength(0);
  });

  it("stores aggregate reaction counts against the post", async () => {
    const db = stubDb(); adminDbMock.mockReturnValue(db);
    const res = await POST(req({
      message_reaction_count: { message_id: 777, reactions: [{ total_count: 3 }, { total_count: 2 }] },
    }) as never);
    expect(res.status).toBe(200);
    expect(db._calls[0]).toMatchObject({ table: "channel_posts", id: 777 });
    expect(db._calls[0].payload.reactions).toBe(5);
  });

  it("ignores unrelated updates with 200", async () => {
    adminDbMock.mockReturnValue(stubDb());
    const res = await POST(req({ message: { text: "hi" } }) as never);
    expect(res.status).toBe(200);
  });
});
