import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getMessages, getContact, send, setTag, __resetTokenForTests } from "./sendpulse";

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
const isToken = (url: string) => url.endsWith("/oauth/access_token");
const tokenOk = () => json({ access_token: "T", expires_in: 3600 });

beforeEach(() => {
  process.env.SENDPULSE_API_ID = "id";
  process.env.SENDPULSE_API_SECRET = "secret";
  __resetTokenForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("getMessages", () => {
  it("returns the latest N oldest-first, flags flow messages", async () => {
    mockFetch((url) => {
      if (isToken(url)) return tokenOk();
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
      if (isToken(url)) return json({ access_token: `T${++n}`, expires_in: 3600 });
      const auth = (calls.at(-1)!.init!.headers as Record<string, string>).Authorization;
      return auth === "Bearer T1" ? json({}, 401) : json({ data: [], meta: { total: 0 } });
    });
    await expect(getMessages("c1")).resolves.toEqual([]);
    expect(n).toBe(2);
  });

  it("drops rows with no id before slicing", async () => {
    mockFetch((url) => {
      if (isToken(url)) return tokenOk();
      return json({ data: [
        { id: "m2", direction: 1, created_at: "2026-09-15T10:00:02Z", data: { text: "hi" } },
        { direction: 1, created_at: "2026-09-15T10:00:01Z", data: { text: "no id field" } },
        { id: "", direction: 1, created_at: "2026-09-15T10:00:00Z", data: { text: "empty id" } },
        { id: null, direction: 1, created_at: "2026-09-15T10:00:00Z", data: { text: "null id" } },
      ] });
    });
    const msgs = await getMessages("c1");
    expect(msgs.map((m) => m.id)).toEqual(["m2"]);
  });

  it("renders a caption-less photo message as [attachment]", async () => {
    mockFetch((url) => {
      if (isToken(url)) return tokenOk();
      return json({ data: [
        { id: "m1", direction: 1, created_at: "2026-09-15T10:00:00Z", data: { photo: { id: "p1" } } },
      ] });
    });
    const [msg] = await getMessages("c1");
    expect(msg.text).toBe("[attachment]");
  });

  it("rejects (never resolves empty) after exhausting the one retry on a 500", async () => {
    vi.useFakeTimers();
    mockFetch((url) => (isToken(url) ? tokenOk() : json({}, 500)));
    const result = expect(getMessages("c1")).rejects.toThrow("500");
    await vi.advanceTimersByTimeAsync(1000);
    await result;
  });

  it("rejects naming the missing credential, without throwing an unrelated error", async () => {
    delete process.env.SENDPULSE_API_ID;
    try {
      mockFetch(() => json({}, 200));
      await expect(getMessages("c1")).rejects.toThrow("SENDPULSE_API_ID");
    } finally {
      process.env.SENDPULSE_API_ID = "id";
    }
  });
});

describe("getContact", () => {
  it("normalises username, business flag and tags", async () => {
    mockFetch((url) => {
      if (isToken(url)) return tokenOk();
      return json({ data: { id: "c1", channel_data: { username: "Sam_T", first_name: "Sam" },
        business_connection: { id: "b" }, tags: [{ name: "country_UK/USA" }, "capital_under100"] } });
    });
    await expect(getContact("c1")).resolves.toEqual({
      id: "c1", username: "Sam_T", firstName: "Sam", isBusiness: true, tags: ["country_UK/USA", "capital_under100"],
    });
  });

  it("drops empty tag names", async () => {
    mockFetch((url) => {
      if (isToken(url)) return tokenOk();
      return json({ data: { id: "c2", channel_data: {}, tags: [{ name: "" }, "", "intent_signals", { name: "exp_mid" }] } });
    });
    await expect(getContact("c2")).resolves.toMatchObject({ tags: ["intent_signals", "exp_mid"], username: null, firstName: "" });
  });
});

describe("send", () => {
  it("posts a text message and reports success", async () => {
    mockFetch((url) => {
      if (isToken(url)) return tokenOk();
      return json({ success: true });
    });
    await expect(send("c1", "hello")).resolves.toBe(true);
    const body = JSON.parse(String(calls[1].init!.body));
    expect(body).toEqual({ contact_id: "c1", message: { type: "text", text: "hello" } });
  });

  it("returns false on a 502, without retrying the send", async () => {
    let sendCalls = 0;
    mockFetch((url) => {
      if (isToken(url)) return tokenOk();
      sendCalls++;
      return json({}, 502);
    });
    await expect(send("c1", "hello")).resolves.toBe(false);
    expect(sendCalls).toBe(1);
  });

  it("retries once after a 429 and succeeds", async () => {
    vi.useFakeTimers();
    let sendCalls = 0;
    mockFetch((url) => {
      if (isToken(url)) return tokenOk();
      sendCalls++;
      return sendCalls === 1 ? json({}, 429) : json({ success: true });
    });
    const result = expect(send("c1", "hello")).resolves.toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    await result;
    expect(sendCalls).toBe(2);
  });

  it("resolves to false, never throws, when fetch rejects with a network error", async () => {
    mockFetch((url) => {
      if (isToken(url)) return tokenOk();
      throw new Error("network down");
    });
    await expect(send("c1", "hello")).resolves.toBe(false);
  });

  it("resolves to false when the API returns 200 with success:false", async () => {
    mockFetch((url) => {
      if (isToken(url)) return tokenOk();
      return json({ success: false });
    });
    await expect(setTag("c1", "vip")).resolves.toBe(false);
  });

  it("resolves to false when credentials are missing, without throwing", async () => {
    delete process.env.SENDPULSE_API_ID;
    try {
      mockFetch(() => json({}, 200));
      await expect(send("c1", "hello")).resolves.toBe(false);
    } finally {
      process.env.SENDPULSE_API_ID = "id";
    }
  });
});
