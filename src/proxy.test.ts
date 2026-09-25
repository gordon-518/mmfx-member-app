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

/** The fn_log_event_as calls carrying one particular event name. */
function eventCalls(fetchMock: ReturnType<typeof vi.fn>, event: string) {
  return rpcCalls(fetchMock).filter(
    (c) => JSON.parse(String((c[1] as RequestInit).body)).p_event === event
  );
}

function touchCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((c) => String(c[0]).includes("/rest/v1/rpc/fn_record_touch"));
}

function bodyOf(call: unknown[]) {
  return JSON.parse(String((call[1] as RequestInit).body));
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

    const calls = eventCalls(fetchMock, "email_visit");
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

  it("hands every attribution write to the fetch event so the edge runtime keeps it alive", async () => {
    withUser(WEI);
    const waitUntil = vi.fn();
    await proxy(
      new NextRequest("https://app.test/daily-analysis?cid=EML-nurture-digest"),
      { waitUntil } as unknown as import("next/server").NextFetchEvent
    );
    // email_visit + cid_visit + the touch row.
    expect(waitUntil).toHaveBeenCalledTimes(3);
    for (const [arg] of waitUntil.mock.calls) expect(arg).toBeInstanceOf(Promise);
  });

  it("does not log for a signed-out visitor — there is no one to attribute it to", async () => {
    withUser(null);
    await proxy(new NextRequest("https://app.test/daily-analysis?cid=EML-nurture-digest"));
    expect(rpcCalls(fetchMock)).toHaveLength(0);
    expect(touchCalls(fetchMock)).toHaveLength(0);
  });

  it("ignores a malformed cid rather than storing whatever the URL carried", async () => {
    withUser(WEI);
    for (const cid of ["EML-", "XYZ-ren-hook", "AGY-ren-<script>", ""]) {
      await proxy(new NextRequest(`https://app.test/daily-analysis?cid=${encodeURIComponent(cid)}`));
    }
    expect(rpcCalls(fetchMock)).toHaveLength(0);
    expect(touchCalls(fetchMock)).toHaveLength(0);
  });

  it("does nothing on a page with no cid at all", async () => {
    withUser(WEI);
    await proxy(new NextRequest("https://app.test/daily-analysis"));
    expect(rpcCalls(fetchMock)).toHaveLength(0);
    expect(touchCalls(fetchMock)).toHaveLength(0);
  });

  it("stays silent when the service-role key is not configured", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    withUser(WEI);
    await proxy(new NextRequest("https://app.test/daily-analysis?cid=EML-trial-welcome"));
    expect(rpcCalls(fetchMock)).toHaveLength(0);
    expect(touchCalls(fetchMock)).toHaveLength(0);
  });

  it("never lets a failed log break the request", async () => {
    // Fire-and-forget: the reader's page must render whatever Supabase does.
    fetchMock.mockRejectedValue(new Error("network down"));
    withUser(WEI);
    const res = await proxy(new NextRequest("https://app.test/daily-analysis?cid=EML-trial-welcome"));
    expect(res.status).toBe(200);
  });
});

// Partner attribution (design 2026-09-25 §2.2). The same middleware hook,
// widened past EML-: every recognised cid now also writes a cid_visit event
// and a row in the touch log, which is what makes "which ad did this funded
// client last see" answerable at all.
describe("proxy — cid_visit and the touch log", () => {
  it("logs a cid_visit and a touch for a partner landing, and no email_visit", async () => {
    withUser(WEI);
    await proxy(
      new NextRequest("https://app.test/daily-analysis?cid=AGY-ren-Gold%20Hook%2003&geo=MY")
    );

    expect(eventCalls(fetchMock, "email_visit")).toHaveLength(0);

    const visits = eventCalls(fetchMock, "cid_visit");
    expect(visits).toHaveLength(1);
    expect(bodyOf(visits[0])).toEqual({
      p_user_id: WEI.id,
      p_event: "cid_visit",
      p_props: { cid: "AGY-ren-Gold Hook 03", path: "/daily-analysis" },
    });

    const touches = touchCalls(fetchMock);
    expect(touches).toHaveLength(1);
    expect(bodyOf(touches[0])).toEqual({
      p_user_id: WEI.id,
      p_cid: "AGY-ren-Gold Hook 03",
      p_geo: "MY",
      p_path: "/daily-analysis",
      p_anon_id: null,
    });
    const headers = (touches[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer service");
  });

  it("logs all three for an EML- landing, so no email KPI changes", async () => {
    withUser(WEI);
    await proxy(new NextRequest("https://app.test/daily-analysis?cid=EML-nurture-digest"));
    expect(eventCalls(fetchMock, "email_visit")).toHaveLength(1);
    expect(eventCalls(fetchMock, "cid_visit")).toHaveLength(1);
    expect(touchCalls(fetchMock)).toHaveLength(1);
  });

  it("covers our own paid and organic cids too", async () => {
    withUser(WEI);
    for (const cid of ["CRT-my-analysis-01", "ORG-tg-2026-09-22"]) {
      await proxy(new NextRequest(`https://app.test/daily-analysis?cid=${cid}`));
    }
    expect(eventCalls(fetchMock, "cid_visit")).toHaveLength(2);
    expect(touchCalls(fetchMock)).toHaveLength(2);
    expect(eventCalls(fetchMock, "email_visit")).toHaveLength(0);
  });

  it("leaves a junk geo to the database to drop rather than guessing", async () => {
    withUser(WEI);
    await proxy(
      new NextRequest("https://app.test/daily-analysis?cid=AGY-ren-hook&geo=Malaysia")
    );
    // fn_record_touch is the validator; the edge just passes it through.
    expect(bodyOf(touchCalls(fetchMock)[0])).toMatchObject({ p_geo: "Malaysia" });
  });

  it("never lets a failed touch break the request", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    withUser(WEI);
    const res = await proxy(new NextRequest("https://app.test/daily-analysis?cid=AGY-ren-hook"));
    expect(res.status).toBe(200);
  });
});

describe("proxy — the first-run gate", () => {
  const NEW_USER: User = {
    id: "22222222-2222-4222-8222-222222222222",
    email: "new@example.com",
    created_at: "2026-09-20T00:00:00Z",
    user_metadata: {},
  };

  it("sends a brand-new member to /welcome once", async () => {
    withUser(NEW_USER);
    const res = await proxy(new NextRequest("https://app.test/daily-analysis"));
    expect(res.headers.get("location")).toContain("/welcome");
  });

  it("leaves the partner report alone — it is not a member page", async () => {
    // A keyed report for an outside agency. Redirecting a signed-in reader to
    // /welcome would make the link look broken.
    withUser(NEW_USER);
    const res = await proxy(new NextRequest("https://app.test/partners/ren?key=abc"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
