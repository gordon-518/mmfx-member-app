import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks must be hoisted above the route import.
const m = vi.hoisted(() => ({
  deskAuthorized: vi.fn(),
  getDeskAnalysis: vi.fn(),
  generatePlain: vi.fn(),
  maybeSingle: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock("@/lib/fa/guard", () => ({ deskAuthorized: m.deskAuthorized }));
vi.mock("@/lib/fa/desk", () => ({ getDeskAnalysis: m.getDeskAnalysis }));
vi.mock("@/lib/fa/plain", async (orig) => ({ ...(await orig<typeof import("@/lib/fa/plain")>()), generatePlain: m.generatePlain }));
vi.mock("@/i18n/server", async (orig) => ({ ...(await orig<typeof import("@/i18n/server")>()), getLocale: async () => "en" }));
vi.mock("@/lib/channel/db", () => ({
  adminDb: () => ({
    from: () => ({
      select: () => ({ match: () => ({ maybeSingle: m.maybeSingle }) }),
      upsert: m.upsert,
    }),
  }),
}));

import { GET } from "./route";

const PLAIN = { what_happened: "Gold rose.", desk_view: "The desk leans up.", what_changes: "A strong dollar." };
const ENVELOPE = { analysis: { generated_at: "2026-11-04T09:00:00Z" } };
const req = (q: string) => new Request(`https://app.test/api/fundamental/plain${q}`);

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.deskAuthorized.mockResolvedValue(true);
  m.getDeskAnalysis.mockResolvedValue(ENVELOPE);
  m.maybeSingle.mockResolvedValue({ data: null, error: null });
  m.upsert.mockResolvedValue({ error: null });
});

describe("GET /api/fundamental/plain", () => {
  it("a viewer who can't open the desk → 401", async () => {
    m.deskAuthorized.mockResolvedValue(false);
    expect((await GET(req("?instrument=XAUUSD"))).status).toBe(401);
  });

  it("an instrument outside the registry → 400, and the desk is never asked", async () => {
    expect((await GET(req("?instrument=NOPE"))).status).toBe(400);
    expect(m.getDeskAnalysis).not.toHaveBeenCalled();
  });

  it("a saved version is served without calling the model", async () => {
    m.maybeSingle.mockResolvedValue({ data: { body: PLAIN }, error: null });
    const res = await GET(req("?instrument=XAUUSD"));
    expect(await res.json()).toMatchObject({ ok: true, plain: PLAIN });
    expect(m.generatePlain).not.toHaveBeenCalled();
  });

  it("the first view writes it and saves it under the thesis and language", async () => {
    m.generatePlain.mockResolvedValue({ plain: PLAIN, model: "claude-opus-5-5" });
    const res = await GET(req("?instrument=EURUSD"));
    expect(await res.json()).toMatchObject({ ok: true, plain: PLAIN });
    expect(m.generatePlain.mock.calls[0][0]).toMatchObject({ assetName: "EUR/USD", locale: "en" });
    expect(m.upsert.mock.calls[0][0]).toMatchObject({
      instrument: "EURUSD",
      generated_at: "2026-11-04T09:00:00Z",
      locale: "en",
      body: PLAIN,
    });
  });

  it("a failed generation → 503 and nothing is saved", async () => {
    m.generatePlain.mockResolvedValue({ plain: null, model: "x", error: "boom" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await GET(req("?instrument=XAUUSD"))).status).toBe(503);
    expect(m.upsert).not.toHaveBeenCalled();
  });
});
