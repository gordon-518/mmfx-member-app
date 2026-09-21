import { describe, it, expect, vi, beforeEach } from "vitest";

const { serviceClientMock } = vi.hoisted(() => ({ serviceClientMock: vi.fn() }));
vi.mock("@/lib/journal/api", () => ({ serviceClient: serviceClientMock }));

import { GET, POST } from "./route";

function stubDb() {
  const calls: { table: string; payload: Record<string, unknown>; col: string; value: unknown }[] = [];
  return {
    calls,
    from(table: string) {
      return {
        update(payload: Record<string, unknown>) {
          return {
            eq(col: string, value: unknown) {
              calls.push({ table, payload, col, value });
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      };
    },
  };
}

function req(url: string) {
  // The route reads nextUrl, which NextRequest derives from the Request URL.
  return { nextUrl: new URL(url) } as never;
}

beforeEach(() => serviceClientMock.mockReset());

describe("/api/email/unsubscribe", () => {
  it("flips the marketing opt-out for the token on GET", async () => {
    const db = stubDb();
    serviceClientMock.mockReturnValue(db);

    const res = await GET(req("https://app.test/api/email/unsubscribe?token=tok123"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("You&#039;ve been unsubscribed".replace("&#039;", "'"));

    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].table).toBe("email_prefs");
    expect(db.calls[0].col).toBe("unsub_token");
    expect(db.calls[0].value).toBe("tok123");
    expect(db.calls[0].payload.marketing_opted_out).toBe(true);
  });

  it("honours POST — the RFC 8058 one-click path Gmail uses", async () => {
    const db = stubDb();
    serviceClientMock.mockReturnValue(db);
    const res = await POST(req("https://app.test/api/email/unsubscribe?token=tok456"));
    expect(res.status).toBe(200);
    expect(db.calls[0].value).toBe("tok456");
  });

  it("leaves the journal's separate consent alone", async () => {
    const db = stubDb();
    serviceClientMock.mockReturnValue(db);
    await GET(req("https://app.test/api/email/unsubscribe?token=tok123"));
    expect(db.calls.map((c) => c.table)).not.toContain("journal_email_prefs");
  });

  it("shows the same page for a missing token, so nothing can be enumerated", async () => {
    const db = stubDb();
    serviceClientMock.mockReturnValue(db);
    const withToken = await GET(req("https://app.test/api/email/unsubscribe?token=tok123"));
    const without = await GET(req("https://app.test/api/email/unsubscribe"));
    expect(await without.text()).toBe(await withToken.text());
    expect(db.calls).toHaveLength(1);
  });
});
