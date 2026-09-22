import { describe, it, expect, vi, beforeEach } from "vitest";

const { serviceClientMock, sendEmailMock } = vi.hoisted(() => ({
  serviceClientMock: vi.fn(),
  sendEmailMock: vi.fn(),
}));
vi.mock("@/lib/journal/api", () => ({ serviceClient: serviceClientMock }));
vi.mock("@/lib/sendpulse", () => ({ sendEmail: sendEmailMock }));

import { POST, contextFor, parseDigestDays, parseSender, parseSpotlightDay } from "./route";

function req(auth = "Bearer testsecret") {
  return new Request("https://app.test/api/cron/email-lifecycle", {
    method: "POST",
    headers: { Authorization: auth },
  });
}

type Row = Record<string, unknown>;

function claimedRow(over: Row = {}): Row {
  return {
    send_id: "s1",
    user_id: "u1",
    email: "wei@example.com",
    first_name: "Wei",
    flow: "trial",
    step: "welcome",
    dedupe_key: "u1:trial:welcome",
    audience: "trial",
    account_status: "trial_active",
    trial_ends_at: "2026-10-05T00:00:00Z",
    deposit_amount: null,
    grandfathered: false,
    lifetime_plan: null,
    days_since_signup: 0,
    onb_tv: false,
    onb_analysis: false,
    onb_kys: false,
    onb_lesson1: false,
    onb_desk: false,
    analysis_title: "Gold holds the 4H range high",
    analysis_bias: "bullish",
    analysis_description: "Pressing the range high into London.",
    unsub_token: "tok123",
    upgrade_viewed_at: null,
    upgrade_broker_clicked_at: null,
    spotlight_id: null,
    ...over,
  };
}

/** Minimal chainable Supabase stub; records the rpc args and every update. */
function stubDb(claimed: Row[], spotlights: Row[] = []) {
  const updates: { id: unknown; payload: Row }[] = [];
  const deletes: unknown[] = [];
  const rpcArgs: Row[] = [];
  const api = {
    rpc(_fn: string, args: Row) {
      rpcArgs.push(args);
      return Promise.resolve({ data: claimed, error: null });
    },
    from(table: string) {
      return {
        select() {
          return { in: () => Promise.resolve({ data: table === "email_spotlights" ? spotlights : [] }) };
        },
        update(payload: Row) {
          return {
            eq: (_col: string, id: unknown) => {
              updates.push({ id, payload });
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
        delete() {
          return {
            eq: (_col: string, id: unknown) => {
              deletes.push(id);
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      };
    },
    _updates: updates,
    _deletes: deletes,
    _rpcArgs: rpcArgs,
  };
  return api;
}

beforeEach(() => {
  serviceClientMock.mockReset();
  sendEmailMock.mockReset();
  sendEmailMock.mockResolvedValue({ ok: true, detail: { result: true } });
  process.env.CRON_SECRET = "testsecret";
  process.env.EMAIL_LIFECYCLE_ENABLED = "true";
  delete process.env.EMAIL_FROM_MARKETING;
  delete process.env.DIGEST_DAYS;
  delete process.env.SPOTLIGHT_DAY;
  delete process.env.EMAIL_LIFECYCLE_BATCH;
});

describe("POST /api/cron/email-lifecycle", () => {
  it("rejects a bad secret with 401", async () => {
    const res = await POST(req("Bearer wrong") as never);
    expect(res.status).toBe(401);
    expect(serviceClientMock).not.toHaveBeenCalled();
  });

  it("claims nothing while EMAIL_LIFECYCLE_ENABLED is off", async () => {
    process.env.EMAIL_LIFECYCLE_ENABLED = "false";
    const res = await POST(req() as never);
    expect(await res.json()).toEqual({ disabled: true });
    expect(serviceClientMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("is off when the flag is simply absent — the default everywhere", async () => {
    delete process.env.EMAIL_LIFECYCLE_ENABLED;
    expect(await (await POST(req() as never)).json()).toEqual({ disabled: true });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("renders a claimed row and sends it with the one-click headers", async () => {
    const db = stubDb([claimedRow()]);
    serviceClientMock.mockReturnValue(db);

    const res = await POST(req() as never);
    expect(await res.json()).toEqual({ claimed: 1, sent: 1, failed: 0, released: 0 });

    expect(sendEmailMock).toHaveBeenCalledOnce();
    const params = sendEmailMock.mock.calls[0][0];
    expect(params.to).toEqual({ name: "Wei", email: "wei@example.com" });
    expect(params.from).toEqual({ name: "Market Makers FX", email: "hello@marketmakersfx.net" });
    expect(params.subject).toBe("Welcome in — start with today's gold read");
    expect(params.html).toContain("MARKET MAKERS FX");
    expect(params.headers).toEqual({
      "List-Unsubscribe": "<https://app.marketmakersfx.net/api/email/unsubscribe?token=tok123>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("stamps ok on the claimed row", async () => {
    const db = stubDb([claimedRow()]);
    serviceClientMock.mockReturnValue(db);
    await POST(req() as never);
    expect(db._updates).toEqual([{ id: "s1", payload: { ok: true, error: null } }]);
  });

  it("logs a send failure against its row and does not retry it", async () => {
    sendEmailMock.mockResolvedValue({ ok: false, detail: "smtp rejected" });
    const db = stubDb([claimedRow()]);
    serviceClientMock.mockReturnValue(db);

    const res = await POST(req() as never);
    expect(await res.json()).toEqual({ claimed: 1, sent: 0, failed: 1, released: 0 });
    expect(sendEmailMock).toHaveBeenCalledOnce();
    // An attempted send is recorded and never retried; the row stays.
    expect(db._updates[0].payload).toEqual({ ok: false, error: "smtp rejected" });
    expect(db._deletes).toEqual([]);
  });

  it("releases the claim when a step never renders, so it can retry", async () => {
    // Stamping ok = false here would burn the unique dedupe_key forever AND
    // spend the user's one-per-day slot on an email they never received.
    const db = stubDb([claimedRow({ send_id: "s2", step: "no-such-step" })]);
    serviceClientMock.mockReturnValue(db);

    const res = await POST(req() as never);
    expect(await res.json()).toEqual({ claimed: 1, sent: 0, failed: 0, released: 1 });
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(db._updates).toEqual([]);
    expect(db._deletes).toEqual(["s2"]);
  });

  it("sends the brain's approved spotlight body inside the rail's shell", async () => {
    const db = stubDb(
      [
        claimedRow({
          flow: "nurture",
          step: "spotlight",
          audience: "expired",
          account_status: "trial_expired",
          spotlight_id: "sp1",
          dedupe_key: "u1:nurture:spotlight:sp1",
        }),
      ],
      [
        {
          id: "sp1",
          subject: "Liquidity, explained",
          html: "<p>Body</p>",
          text: "Body",
          guide_url: "https://marketmakersfx.net/guides/liquidity",
        },
      ]
    );
    serviceClientMock.mockReturnValue(db);

    await POST(req() as never);
    const params = sendEmailMock.mock.calls[0][0];
    expect(params.subject).toBe("Liquidity, explained");
    expect(params.html).toContain("<p>Body</p>");
    expect(params.html).toContain("MARKET MAKERS FX");
    expect(params.html).toContain("api/email/unsubscribe?token=tok123");
    expect(params.html).toContain("https://marketmakersfx.net/guides/liquidity?cid=EML-nurture-spotlight");
    expect(params.text).toContain("Trading involves risk");
  });

  it("fails the send rather than guessing when the spotlight row is gone", async () => {
    const db = stubDb(
      [claimedRow({ flow: "nurture", step: "spotlight", audience: "expired", spotlight_id: "sp9" })],
      []
    );
    serviceClientMock.mockReturnValue(db);

    await POST(req() as never);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(db._updates).toEqual([]);
    expect(db._deletes).toEqual(["s1"]);
  });

  it("skips an audience no template speaks to", async () => {
    const db = stubDb([claimedRow({ audience: "removed" })]);
    serviceClientMock.mockReturnValue(db);
    await POST(req() as never);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(db._updates).toEqual([]);
    expect(db._deletes).toEqual(["s1"]);
  });

  it("passes the batch size and DIGEST_DAYS through to the claim function", async () => {
    process.env.DIGEST_DAYS = "1,2,5";
    process.env.SPOTLIGHT_DAY = "2";
    process.env.EMAIL_LIFECYCLE_BATCH = "50";
    const db = stubDb([]);
    serviceClientMock.mockReturnValue(db);
    await POST(req() as never);
    expect(db._rpcArgs[0]).toEqual({ p_limit: 50, p_digest_days: [1, 2, 5], p_spotlight_day: 2 });
  });

  it("claims a small default batch, so a killed run strands few rows", async () => {
    const db = stubDb([]);
    serviceClientMock.mockReturnValue(db);
    await POST(req() as never);
    expect(db._rpcArgs[0]).toEqual({ p_limit: 200, p_digest_days: [1, 2, 3, 4, 5], p_spotlight_day: 6 });
  });

  it("returns 500 when the claim itself fails", async () => {
    serviceClientMock.mockReturnValue({
      rpc: () => Promise.resolve({ data: null, error: { message: "boom" } }),
    });
    const res = await POST(req() as never);
    expect(res.status).toBe(500);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("parseSender", () => {
  it("defaults to the marketing address when unset", () => {
    expect(parseSender(undefined)).toEqual({
      name: "Market Makers FX",
      email: "hello@marketmakersfx.net",
    });
  });
  it('reads "Name <address>"', () => {
    expect(parseSender("Market Makers <news@mail.marketmakersfx.net>")).toEqual({
      name: "Market Makers",
      email: "news@mail.marketmakersfx.net",
    });
  });
  it("accepts a bare address", () => {
    expect(parseSender("news@marketmakersfx.net")).toEqual({
      name: "Market Makers FX",
      email: "news@marketmakersfx.net",
    });
  });
  it("falls back rather than sending from nonsense", () => {
    expect(parseSender("not an address").email).toBe("hello@marketmakersfx.net");
  });
});

describe("parseDigestDays", () => {
  it("defaults to Mon/Wed/Fri", () => {
    expect(parseDigestDays(undefined)).toEqual([1, 2, 3, 4, 5]);
    expect(parseDigestDays("")).toEqual([1, 2, 3, 4, 5]);
    expect(parseDigestDays("nonsense")).toEqual([1, 2, 3, 4, 5]);
  });
  it("reads a comma list and drops out-of-range days", () => {
    expect(parseDigestDays("1, 4 ,9,4")).toEqual([1, 4]);
  });
});

describe("parseSpotlightDay", () => {
  it("defaults to Thursday, off the Mon/Wed/Fri digest days", () => {
    expect(parseSpotlightDay(undefined)).toBe(6);
    expect(parseSpotlightDay("0")).toBe(6);
    expect(parseSpotlightDay("eh")).toBe(6);
  });
  it("reads a valid ISO day-of-week", () => {
    expect(parseSpotlightDay("2")).toBe(2);
  });
});

describe("contextFor", () => {
  it("derives the tier from the raw inputs with tierFor()", () => {
    const ctx = contextFor(
      claimedRow({
        audience: "member",
        account_status: "member_active",
        trial_ends_at: null,
        deposit_amount: "250",
      }) as never
    );
    expect(ctx!.tier).toBe("desk");
    expect(ctx!.audience).toBe("member");
  });

  it("builds the unsubscribe URL from the token", () => {
    const ctx = contextFor(claimedRow({ unsub_token: "a b/c" }) as never);
    expect(ctx!.unsubUrl).toBe(
      "https://app.marketmakersfx.net/api/email/unsubscribe?token=a%20b%2Fc"
    );
  });

  it("keeps the analysis but drops a bias it doesn't recognise", () => {
    // daily_analysis.bias is nullable. Dropping the whole read over a missing
    // bias would have mailed an empty digest to the entire Free tier.
    const da = contextFor(claimedRow({ analysis_bias: "sideways" }) as never)!.todayAnalysis;
    expect(da!.title).toBe("Gold holds the 4H range high");
    expect(da!.bias).toBeNull();
  });

  it("keeps the analysis when the bias column is null", () => {
    const da = contextFor(claimedRow({ analysis_bias: null }) as never)!.todayAnalysis;
    expect(da!.title).toBe("Gold holds the 4H range high");
    expect(da!.bias).toBeNull();
  });

  it("has no analysis at all when nothing was published", () => {
    expect(contextFor(claimedRow({ analysis_title: null }) as never)!.todayAnalysis).toBeNull();
  });

  it("returns null for an audience no flow targets", () => {
    expect(contextFor(claimedRow({ audience: "removed" }) as never)).toBeNull();
  });
});
