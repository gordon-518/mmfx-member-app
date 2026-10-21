import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks must be hoisted above the route import.
const { deskAuthorizedMock } = vi.hoisted(() => ({ deskAuthorizedMock: vi.fn() }));
vi.mock("@/lib/fa/guard", () => ({ deskAuthorized: deskAuthorizedMock }));

import { GET } from "./route";

function req(query: string) {
  return new Request(`https://app.test/api/fundamental/price${query}`);
}

function stubPrice(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status }))
  );
}

beforeEach(() => {
  deskAuthorizedMock.mockReset();
  vi.unstubAllGlobals();
});

describe("GET /api/fundamental/price", () => {
  it("a viewer who can't open the desk → 401", async () => {
    deskAuthorizedMock.mockResolvedValue(false);
    const res = await GET(req("?instrument=XAUUSD"));
    expect(res.status).toBe(401);
  });

  it("an instrument outside the registry → 400, and the desk is never called", async () => {
    deskAuthorizedMock.mockResolvedValue(true);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    // The desk answers with gold for an unknown instrument, so this must not
    // pass through — it would label gold's price as something else.
    const res = await GET(req("?instrument=NOPE"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "bad_instrument" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("a missing instrument → 400", async () => {
    deskAuthorizedMock.mockResolvedValue(true);
    expect((await GET(req(""))).status).toBe(400);
  });

  it("returns the quote for an allowlisted instrument", async () => {
    deskAuthorizedMock.mockResolvedValue(true);
    stubPrice({ price: 4141.7, symbol: "XAU/USD" });
    const res = await GET(req("?instrument=XAUUSD"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      instrument: "XAUUSD",
      price: 4141.7,
      symbol: "XAU/USD",
    });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("a desk outage → 502, never a fabricated price", async () => {
    deskAuthorizedMock.mockResolvedValue(true);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const res = await GET(req("?instrument=EURUSD"));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, reason: "price_unavailable" });
  });

  it("a non-numeric price from the desk → 502", async () => {
    deskAuthorizedMock.mockResolvedValue(true);
    stubPrice({ price: null, symbol: "BTC/USD" });
    expect((await GET(req("?instrument=BTCUSD"))).status).toBe(502);
  });
});
