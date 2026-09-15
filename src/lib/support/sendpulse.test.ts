import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMessages, getContact, send, __resetTokenForTests } from "./sendpulse";

type Call = { url: string; init?: RequestInit };
let calls: Call[];

function mockFetch(routes: (url: string, init?: RequestInit) => Response) {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return routes(url, init);
  }));
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

beforeEach(() => {
  process.env.SENDPULSE_API_ID = "id";
  process.env.SENDPULSE_API_SECRET = "secret";
  __resetTokenForTests();
});

describe("getMessages", () => {
  it("returns the latest N oldest-first, flags flow messages", async () => {
    mockFetch((url) => {
      if (url.endsWith("/oauth/access_token")) return json({ access_token: "T", expires_in: 3600 });
      return json({ data: [
        { id: "m3", direction: 2, block_id: "b1", created_at: "2026-09-15T10:00:03Z", data: { text: "Where are you based?" } },
        { id: "m2", direction: 1, created_at: "2026-09-15T10:00:02Z", data: { text: "Malaysia" } },
        { id: "m1", direction: 2, created_at: "2026-09-15T10:00:01Z", data: { text: "Hi!" } },
      ], meta: { total: 3 } });
    });
    const msgs = await getMessages("c1", 2);
    expect(msgs.map((m) => m.id)).toEqual(["m2", "m3"]);
    expect(msgs[0]).toMatchObject({ direction: "in", fromFlow: false, text: "Malaysia" });
    expect(msgs[1]).toMatchObject({ direction: "out", fromFlow: true });
    expect(calls[1].url).toContain("contact_id=c1");
  });

  it("refreshes the token once on 401", async () => {
    let n = 0;
    mockFetch((url) => {
      if (url.endsWith("/oauth/access_token")) return json({ access_token: `T${++n}`, expires_in: 3600 });
      const auth = (calls.at(-1)!.init!.headers as Record<string, string>).Authorization;
      return auth === "Bearer T1" ? json({}, 401) : json({ data: [], meta: { total: 0 } });
    });
    await expect(getMessages("c1")).resolves.toEqual([]);
    expect(n).toBe(2);
  });
});

describe("getContact", () => {
  it("normalises username, business flag and tags", async () => {
    mockFetch((url) => {
      if (url.endsWith("/oauth/access_token")) return json({ access_token: "T", expires_in: 3600 });
      return json({ data: { id: "c1", channel_data: { username: "Sam_T", first_name: "Sam" },
        business_connection: { id: "b" }, tags: [{ name: "country_UK/USA" }, "capital_under100"] } });
    });
    await expect(getContact("c1")).resolves.toEqual({
      id: "c1", username: "Sam_T", firstName: "Sam", isBusiness: true, tags: ["country_UK/USA", "capital_under100"],
    });
  });

  it("drops empty tag names", async () => {
    mockFetch((url) => {
      if (url.endsWith("/oauth/access_token")) return json({ access_token: "T", expires_in: 3600 });
      return json({ data: { id: "c2", channel_data: {}, tags: [{ name: "" }, "", "intent_signals", { name: "exp_mid" }] } });
    });
    await expect(getContact("c2")).resolves.toMatchObject({ tags: ["intent_signals", "exp_mid"], username: null, firstName: "" });
  });
});

describe("send", () => {
  it("posts a text message and reports success", async () => {
    mockFetch((url) => {
      if (url.endsWith("/oauth/access_token")) return json({ access_token: "T", expires_in: 3600 });
      return json({ success: true });
    });
    await expect(send("c1", "hello")).resolves.toBe(true);
    const body = JSON.parse(String(calls[1].init!.body));
    expect(body).toEqual({ contact_id: "c1", message: { type: "text", text: "hello" } });
  });
});
