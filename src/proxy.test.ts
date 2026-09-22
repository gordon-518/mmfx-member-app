import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { createServerClientMock } = vi.hoisted(() => ({ createServerClientMock: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: createServerClientMock }));

import { NextRequest } from "next/server";
import { proxy } from "./proxy";

// The missing link between an email and what the reader did next (§0.5).
// Without it, a click is the last thing we ever see: the Free tier has no
// signup or deposit to attribute, so every digest looked like it did nothing.

type User = { id: string; email: string; created_at: string; user_metadata?: Record<string, unknown> };

function withUser(user: User | null) {
  createServerClientMock.mockReturnValue({
    auth: { getUser: async () => ({ data: { user } }) },
  });
}

const WEI: User = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "wei@example.com",
  // Before the roadmap cutoff, so the first-run gate never redirects here.
  created_at: "2026-01-01T00:00:00Z",
  user_metadata: {},
};

function rpcCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((c) => String(c[0]).includes("/rest/v1/rpc/fn_log_event_as"));
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  createServerClientMock.mockReset();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("proxy — email_visit", () => {
  it("logs one email_visit when a signed-in reader lands from an EML- link", async () => {
    withUser(WEI);
    await proxy(new NextRequest("https://app.test/daily-analysis?cid=EML-nurture-digest"));

    const calls = rpcCalls(fetchMock);
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0] as [string, RequestInit];
    expect(url).toBe("https://proj.supabase.test/rest/v1/rpc/fn_log_event_as");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      p_user_id: WEI.id,
      p_event: "email_visit",
      p_props: { cid: "EML-nurture-digest", path: "/daily-analysis" },
    });
    // The service role is the only role fn_log_event_as is granted to.
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer service");
    expect(headers.apikey).toBe("service");
  });

  it("hands the attribution write to the fetch event so the edge runtime keeps it alive", async () => {
    withUser(WEI);
    const waitUntil = vi.fn();
    await proxy(
      new NextRequest("https://app.test/daily-analysis?cid=EML-nurture-digest"),
      { waitUntil } as unknown as import("next/server").NextFetchEvent
    );
    expect(rpcCalls(fetchMock)).toHaveLength(1);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(waitUntil.mock.calls[0][0]).toBeInstanceOf(Promise);
  });

  it("does not log for a signed-out visitor — there is no one to attribute it to", async () => {
    withUser(null);
    await proxy(new NextRequest("https://app.test/daily-analysis?cid=EML-nurture-digest"));
    expect(rpcCalls(fetchMock)).toHaveLength(0);
  });

  it("ignores a cid from another channel", async () => {
    withUser(WEI);
    await proxy(new NextRequest("https://app.test/daily-analysis?cid=ORG-tg-2026-09-22"));
    expect(rpcCalls(fetchMock)).toHaveLength(0);
  });

  it("ignores a malformed cid rather than storing whatever the URL carried", async () => {
    withUser(WEI);
    for (const cid of ["EML-", "EML-<script>", "EML-NURTURE-DIGEST", ""]) {
      await proxy(new NextRequest(`https://app.test/daily-analysis?cid=${encodeURIComponent(cid)}`));
    }
    expect(rpcCalls(fetchMock)).toHaveLength(0);
  });

  it("does nothing on a page with no cid at all", async () => {
    withUser(WEI);
    await proxy(new NextRequest("https://app.test/daily-analysis"));
    expect(rpcCalls(fetchMock)).toHaveLength(0);
  });

  it("stays silent when the service-role key is not configured", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    withUser(WEI);
    await proxy(new NextRequest("https://app.test/daily-analysis?cid=EML-trial-welcome"));
    expect(rpcCalls(fetchMock)).toHaveLength(0);
  });

  it("never lets a failed log break the request", async () => {
    // Fire-and-forget: the reader's page must render whatever Supabase does.
    fetchMock.mockRejectedValue(new Error("network down"));
    withUser(WEI);
    const res = await proxy(new NextRequest("https://app.test/daily-analysis?cid=EML-trial-welcome"));
    expect(res.status).toBe(200);
  });
});
