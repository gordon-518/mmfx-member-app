import { describe, it, expect, vi, beforeEach } from "vitest";

const { serviceClientMock } = vi.hoisted(() => ({ serviceClientMock: vi.fn() }));
vi.mock("@/lib/journal/api", () => ({ serviceClient: serviceClientMock }));

import { POST } from "./route";

function stubDb() {
  const inserts: Record<string, unknown>[] = [];
  return {
    inserts,
    from() {
      return {
        insert(payload: Record<string, unknown>) {
          inserts.push(payload);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: "sp1", approved_at: "now" }, error: null }),
            }),
          };
        },
      };
    },
  };
}

function req(body: unknown, auth = "Bearer testsecret") {
  return new Request("https://app.test/api/email/spotlight", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

const GOOD = { subject: "Liquidity, explained", html: "<p>Body</p>", text: "Body" };

beforeEach(() => {
  serviceClientMock.mockReset();
  process.env.CRON_SECRET = "testsecret";
});

describe("POST /api/email/spotlight", () => {
  it("rejects a bad secret with 401", async () => {
    expect((await POST(req(GOOD, "Bearer wrong"))).status).toBe(401);
    expect(serviceClientMock).not.toHaveBeenCalled();
  });

  it("stores an approved row", async () => {
    const db = stubDb();
    serviceClientMock.mockReturnValue(db);
    const res = await POST(req({ ...GOOD, guide_url: "https://x/g", cid: "EML-nurture-spotlight" }));
    expect(res.status).toBe(200);
    expect(db.inserts[0]).toMatchObject({
      subject: "Liquidity, explained",
      guide_url: "https://x/g",
      cid: "EML-nurture-spotlight",
    });
    expect(db.inserts[0].approved_at).toBeTruthy();
  });

  it("requires subject, html and text", async () => {
    serviceClientMock.mockReturnValue(stubDb());
    expect((await POST(req({ subject: "x", html: "<p>y</p>" }))).status).toBe(400);
  });

  it.each(["<script>x</script>", "<STYLE>a{}</STYLE>", "<html><p>x</p></html>", "<a href=\"javascript:x\">y</a>"])(
    "refuses a body that is not a plain fragment (%s)",
    async (html) => {
      const db = stubDb();
      serviceClientMock.mockReturnValue(db);
      const res = await POST(req({ ...GOOD, html }));
      expect(res.status).toBe(400);
      expect(db.inserts).toEqual([]);
    }
  );
});
