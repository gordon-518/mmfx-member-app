import { describe, it, expect, vi, beforeEach } from "vitest";

const { adminDbMock } = vi.hoisted(() => ({ adminDbMock: vi.fn() }));
vi.mock("@/lib/channel/db", () => ({ adminDb: adminDbMock }));

import { POST } from "./route";

function req(body: unknown, auth = "Bearer testsecret") {
  return new Request("https://app.test/api/channel/enqueue-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify(body),
  });
}

function stubDb() {
  const inserted: unknown[] = [];
  const api = {
    from() { return api; },
    upsert(rows: unknown[]) { inserted.push(rows); return Promise.resolve({ error: null }); },
    _inserted: inserted,
  };
  return api;
}

const TXT = `========================================
TELEGRAM POST 1 — DAILY ANALYSIS
========================================

Daily body.

========================================
TELEGRAM POST 2 — FUNDAMENTAL ANALYSIS
========================================

Macro body.
`;

beforeEach(() => {
  adminDbMock.mockReset();
  process.env.CHANNEL_CRON_SECRET = "testsecret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supa.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});

describe("POST /api/channel/enqueue-analysis", () => {
  it("401 on bad secret", async () => {
    const res = await POST(req({ date: "2026-06-12", txt: TXT }, "Bearer no") as never);
    expect(res.status).toBe(401);
  });

  it("400 when date or txt missing", async () => {
    adminDbMock.mockReturnValue(stubDb());
    const res = await POST(req({ date: "2026-06-12" }) as never);
    expect(res.status).toBe(400);
  });

  it("enqueues two rows with the right dedupe keys and image/link", async () => {
    const db = stubDb(); adminDbMock.mockReturnValue(db);
    const res = await POST(req({ date: "2026-06-12", txt: TXT, macroImageBase64: Buffer.from("x").toString("base64") }) as never);
    expect(res.status).toBe(200);
    const rows = db._inserted[0] as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    const daily = rows.find((r) => r.kind === "analysis_daily")!;
    const macro = rows.find((r) => r.kind === "analysis_macro")!;
    expect(daily.dedupe_key).toBe("analysis_daily:2026-06-12");
    expect(daily.image_url).toContain("analysis-covers/cover-2026-06-12.png");
    expect(daily.link_url).toContain("/daily-analysis");
    expect(macro.image_url).toContain("channel-assets/macro-2026-06-12.png");
  });
});
