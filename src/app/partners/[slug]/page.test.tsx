import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { partnerDbMock } = vi.hoisted(() => ({ partnerDbMock: vi.fn() }));
vi.mock("@/lib/partners/client", () => ({ partnerDb: partnerDbMock }));

import PartnerPage from "./page";
import { GET } from "./export/route";

// The dashboard has no login: the link carries a key. These are the tests
// that matter most on this page — a wrong key must be indistinguishable from
// a slug that does not exist, and nothing but counts may reach the HTML.
//
// Rendered with renderToStaticMarkup rather than a DOM: the page is a server
// component with no client JS, so its whole output is the markup.

const KEY = "f".repeat(64);
const HASH = createHash("sha256").update(KEY).digest("hex");

const ROWS = [
  {
    week: "2026-09-07",
    label: "Gold Hook 03",
    signups: 40,
    activated: 22,
    funded: 3,
    deposit_total: 1500,
    first_touch_signups: 38,
    first_touch_funded: 4,
  },
  {
    week: "2026-09-14",
    label: "Gold Hook 03",
    signups: 20,
    activated: 9,
    funded: 1,
    deposit_total: 500,
    first_touch_signups: 21,
    first_touch_funded: 1,
  },
  {
    week: "2026-09-14",
    label: "Quiet Ad",
    signups: 10,
    activated: 1,
    funded: 0,
    deposit_total: 0,
    first_touch_signups: 10,
    first_touch_funded: 0,
  },
];

let rpc: ReturnType<typeof vi.fn>;

function stubDb(partner: Record<string, unknown> | null, rows: unknown[] = ROWS) {
  rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    void fn;
    void args;
    return { data: rows, error: null };
  });
  partnerDbMock.mockReturnValue({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: partner, error: null }) }) }),
    }),
    rpc,
  });
}

const REN = { slug: "ren", name: "Ren", key_hash: HASH, active: true };

function render(search: Record<string, string>) {
  return PartnerPage({
    params: Promise.resolve({ slug: "ren" }),
    searchParams: Promise.resolve(search),
  }).then((el) => renderToStaticMarkup(el));
}

beforeEach(() => {
  partnerDbMock.mockReset();
});

describe("/partners/[slug] — the door", () => {
  it("404s on a wrong key", async () => {
    stubDb(REN);
    await expect(render({ key: "0".repeat(64) })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it("404s with no key at all", async () => {
    stubDb(REN);
    await expect(render({})).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it("404s for an unknown partner — same answer as a wrong key", async () => {
    stubDb(null);
    await expect(render({ key: KEY })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it("404s for a deactivated partner holding a once-valid key", async () => {
    stubDb({ ...REN, active: false });
    await expect(render({ key: KEY })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it("never runs the funnel query for a visitor it turned away", async () => {
    stubDb(REN);
    await render({ key: "0".repeat(64) }).catch(() => undefined);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("/partners/[slug] — the page", () => {
  it("renders the headline tiles for a right key", async () => {
    stubDb(REN);
    const html = await render({ key: KEY });
    expect(html).toContain("Ren");
    expect(html).toContain("Signups");
    expect(html).toContain("70"); // 40 + 20 + 10
    expect(html).toContain("Funded");
    expect(html).toContain("$2,000");
    expect(html).toContain("5.7%"); // 4 of 70
  });

  it("lists the ads with the best-funded first", async () => {
    stubDb(REN);
    const html = await render({ key: KEY });
    expect(html.indexOf("Gold Hook 03")).toBeLessThan(html.indexOf("Quiet Ad"));
  });

  it("shows the first-touch numbers beside the paid ones", async () => {
    stubDb(REN);
    const html = await render({ key: KEY });
    expect(html).toContain("69 signups");
    expect(html).toContain("5 funded");
  });

  it("defaults to the paying rule and passes it to the RPC", async () => {
    stubDb(REN);
    await render({ key: KEY });
    expect(rpc).toHaveBeenCalledWith("fn_partner_funnel", expect.objectContaining({
      p_slug: "ren",
      p_rule: "last_paid_7d",
    }));
  });

  it("passes p_rule = first when the toggle is flipped", async () => {
    stubDb(REN);
    await render({ key: KEY, rule: "first" });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_rule: "first" });
  });

  it("carries the key and the rule through every control's link", async () => {
    stubDb(REN);
    const html = await render({ key: KEY, rule: "first", days: "90" });
    expect(html).toContain(`key=${KEY}`);
    expect(html).toContain("rule=first");
    expect(html).toContain("/partners/ren/export?");
  });

  it("shows the URL-parameter template with this partner's own slug", async () => {
    stubDb(REN);
    const html = await render({ key: KEY });
    expect(html).toContain("cid=AGY-ren-");
    expect(html).toContain("utm_medium=paid");
  });

  it("states the attribution rule in plain words, with no promises", async () => {
    stubDb(REN);
    const html = await render({ key: KEY });
    expect(html).toContain("Attribution: last paid touch within 7 days of the deposit.");
    expect(html).toContain("Counts are verified deposits only.");
    expect(html).not.toContain("!");
  });

  it("says so calmly when a range is empty rather than rendering a broken table", async () => {
    stubDb(REN, []);
    const html = await render({ key: KEY });
    expect(html).toContain("No signups carried this tag in this range.");
  });

  it("renders nothing that identifies a member", async () => {
    stubDb(REN);
    const html = await render({ key: KEY });
    for (const leak of ["@", "deposit_verified_at", "user_id", "uuid"]) {
      expect(html, leak).not.toContain(leak);
    }
  });
});

describe("/partners/[slug]/export — the CSV", () => {
  function req(qs: string) {
    return new NextRequest(`https://app.test/partners/ren/export${qs}`);
  }

  it("404s on a wrong key, like the page", async () => {
    stubDb(REN);
    const res = await GET(req(`?key=${"0".repeat(64)}`), {
      params: Promise.resolve({ slug: "ren" }),
    });
    expect(res.status).toBe(404);
  });

  it("serves the same rows as an attachment", async () => {
    stubDb(REN);
    const res = await GET(req(`?key=${KEY}`), { params: Promise.resolve({ slug: "ren" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toContain('filename="ren-funnel-');
    // A key in the URL must not be cached anywhere but the reader's tab.
    expect(res.headers.get("Cache-Control")).toBe("no-store, private");

    const body = await res.text();
    const lines = body.trimEnd().split("\r\n");
    expect(lines[0]).toBe(
      "week,label,signups,activated,funded,deposit_total,first_touch_signups,first_touch_funded"
    );
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe("2026-09-07,Gold Hook 03,40,22,3,1500.00,38,4");
  });

  it("passes the rule toggle through to the RPC", async () => {
    stubDb(REN);
    await GET(req(`?key=${KEY}&rule=first`), { params: Promise.resolve({ slug: "ren" }) });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_rule: "first" });
  });
});
