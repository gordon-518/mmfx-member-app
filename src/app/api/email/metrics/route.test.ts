import { describe, it, expect, vi, beforeEach } from "vitest";

const { serviceClientMock } = vi.hoisted(() => ({ serviceClientMock: vi.fn() }));
vi.mock("@/lib/journal/api", () => ({ serviceClient: serviceClientMock }));

import { FLOWS } from "@/lib/email/lifecycle";
import { GET } from "./route";

type Row = Record<string, unknown>;

function stubDb(rows: Row[], variants: Row[] = []) {
  const rpcArgs: Row[] = [];
  return {
    rpc(_fn: string, args: Row) {
      rpcArgs.push(args);
      return Promise.resolve({ data: rows, error: null });
    },
    from() {
      return {
        select: () => ({ eq: () => Promise.resolve({ data: variants, error: null }) }),
      };
    },
    _rpcArgs: rpcArgs,
  };
}

function req(qs = "", auth = "Bearer testsecret") {
  return new Request(`https://app.test/api/email/metrics${qs}`, {
    headers: { Authorization: auth },
  }) as never;
}

const KPI_ROW = {
  flow: "trial",
  step: "tv",
  variant: "A",
  sends: 310,
  delivered: 305,
  opened: 140,
  clicked: 41,
  visited: 33,
  goal_done: 22,
  unsubscribed: 1,
  complaints: 0,
  bounced: 5,
  open_p50_min: 44.5,
  click_p50_min: 61.0,
};

beforeEach(() => {
  serviceClientMock.mockReset();
  process.env.CRON_SECRET = "testsecret";
});

describe("GET /api/email/metrics", () => {
  it("rejects a bad bearer", async () => {
    expect((await GET(req("", "Bearer wrong"))).status).toBe(401);
    expect(serviceClientMock).not.toHaveBeenCalled();
  });

  it("rejects a request with no bearer at all", async () => {
    expect((await GET(req("", ""))).status).toBe(401);
  });

  it("returns the KPI rows straight off fn_email_kpis", async () => {
    const db = stubDb([KPI_ROW]);
    serviceClientMock.mockReturnValue(db);
    const body = await (await GET(req("?since=2026-08-25T00:00:00Z&until=2026-09-22T00:00:00Z"))).json();
    expect(body.rows).toEqual([KPI_ROW]);
    expect(db._rpcArgs[0]).toEqual({
      p_since: "2026-08-25T00:00:00.000Z",
      p_until: "2026-09-22T00:00:00.000Z",
    });
  });

  it("defaults to the last 28 days when the window is missing or nonsense", async () => {
    const db = stubDb([]);
    serviceClientMock.mockReturnValue(db);
    await GET(req("?since=yesterday"));
    const { p_since, p_until } = db._rpcArgs[0] as { p_since: string; p_until: string };
    const days = (Date.parse(p_until) - Date.parse(p_since)) / 86_400_000;
    expect(Math.round(days)).toBe(28);
  });

  it("carries the current copy for every step the rail can send", async () => {
    serviceClientMock.mockReturnValue(stubDb([KPI_ROW]));
    const body = await (await GET(req())).json();
    const steps = Object.entries(FLOWS).flatMap(([flow, s]) =>
      Object.keys(s).map((step) => `${flow}/${step}`)
    );
    expect(Object.keys(body.copy).sort()).toEqual(steps.sort());
    // 'A' is always the key for the template's own copy, present or not yet.
    for (const key of steps) expect(body.copy[key]).toHaveProperty("A");
  });

  it("puts an active challenger beside the control, under its own key", async () => {
    const copy = {
      subject: "Your TradingView handle",
      preheader: "One field, and the indicators appear.",
      paragraphs: ["Add your handle."],
      ctaLabel: "Add my handle",
    };
    serviceClientMock.mockReturnValue(
      stubDb([KPI_ROW], [{ flow: "trial", step: "tv", variant_key: "B", copy, weight: 50 }])
    );
    const body = await (await GET(req())).json();
    expect(body.copy["trial/tv"].B).toEqual(copy);
    expect(body.copy["trial/welcome"].B).toBeUndefined();
  });

  it("ignores a variant row for a step the registry no longer has", async () => {
    serviceClientMock.mockReturnValue(
      stubDb([], [{ flow: "trial", step: "gone", variant_key: "B", copy: {}, weight: 50 }])
    );
    const body = await (await GET(req())).json();
    expect(body.copy["trial/gone"]).toBeUndefined();
  });

  it("returns 500 when the KPI function itself fails", async () => {
    serviceClientMock.mockReturnValue({
      rpc: () => Promise.resolve({ data: null, error: { message: "boom" } }),
      from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }),
    });
    expect((await GET(req())).status).toBe(500);
  });
});
