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

// ---- sponsors (design 2026-11-05) -----------------------------------------

const OCTA = { slug: "octa", name: "Octa", key_hash: HASH, active: true, kind: "sponsor", brokers: ["octa", "elev8"] };
const WINDOWS = [{ country: "MY", since: "2026-11-01T00:00:00+00:00", until: null }];
const SPONSOR_ROWS = [
  { week: "2026-11-02", label: null, signups: 120, activated: 50, upgrade_viewed: 30, broker_clicked: 12, submitted: 4, funded: 2, deposit_total: 350 },
  { week: "2026-11-02", label: "Gold Hook 03", signups: 40, activated: 25, upgrade_viewed: 15, broker_clicked: 6, submitted: 2, funded: 1, deposit_total: 200 },
];
const CLIENTS = [
  { total: 2, signed_up: "2026-11-03", country: "MY", display: "Aisyah R.", stage: "funded", ad_label: "Gold Hook 03", account_number: "88123456", deposit_total: 200 },
  { total: 2, signed_up: "2026-11-02", country: "MY", display: "Wei L.", stage: "activated", ad_label: null, account_number: null, deposit_total: null },
];

function stubSponsor(partner: Record<string, unknown> | null = OCTA, windows: unknown[] = WINDOWS) {
  rpc = vi.fn(async (fn: string) => {
    if (fn === "fn_sponsor_windows") return { data: windows, error: null };
    if (fn === "fn_sponsor_funnel") return { data: SPONSOR_ROWS, error: null };
    if (fn === "fn_sponsor_clients") return { data: CLIENTS, error: null };
    return { data: [], error: null };
  });
  partnerDbMock.mockReturnValue({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: partner, error: null }) }) }),
    }),
    rpc,
  });
}

function renderSponsor(search: Record<string, string>) {
  return PartnerPage({
    params: Promise.resolve({ slug: "octa" }),
    searchParams: Promise.resolve(search),
  }).then((el) => renderToStaticMarkup(el));
}

describe("/partners/[slug] — a sponsor", () => {
  it("renders the sponsor view: headline, traced, broker-scoped funding", async () => {
    stubSponsor();
    const html = await renderSponsor({ key: KEY });
    expect(html).toContain("Octa");
    expect(html).toContain("Malaysia from 1 Nov 2026");
    expect(html).toContain("160"); // 120 + 40 signups
    expect(html).toContain("Directly traced");
    expect(html).toContain("Funded with Octa / Elev8");
    expect(html).toContain("$550");
    expect(html).toContain("Gold Hook 03");
  });

  it("never runs the agency funnel", async () => {
    stubSponsor();
    await renderSponsor({ key: KEY });
    expect(rpc.mock.calls.map((c) => c[0])).not.toContain("fn_partner_funnel");
  });

  it("defaults to the whole deal: the deal start goes to the RPCs", async () => {
    stubSponsor();
    await renderSponsor({ key: KEY });
    expect(rpc).toHaveBeenCalledWith("fn_sponsor_funnel", expect.objectContaining({ p_slug: "octa", p_since: "2026-11-01T00:00:00.000Z" }));
    expect(rpc).toHaveBeenCalledWith("fn_sponsor_clients", expect.objectContaining({ p_limit: 50, p_offset: 0 }));
  });

  it("lists clients masked, with the account number only on the funded row", async () => {
    stubSponsor();
    const html = await renderSponsor({ key: KEY });
    expect(html).toContain("Aisyah R.");
    expect(html).toContain("Wei L.");
    expect(html.split("88123456")).toHaveLength(2); // exactly once
    expect(html).toContain("Active in the app");
    for (const leak of ["@", "null", "user_id", "uuid"]) {
      expect(html, leak).not.toContain(leak);
    }
  });

  it("carries the key through the range, page and CSV links", async () => {
    stubSponsor();
    const html = await renderSponsor({ key: KEY, days: "30" });
    expect(html).toContain(`key=${KEY}`);
    expect(html).toContain("days=7");
    expect(html).toContain("/partners/octa/export?");
    expect(html).toContain("table=clients");
  });

  it("prints the SPN template with this sponsor's slug and stays calm", async () => {
    stubSponsor();
    const html = await renderSponsor({ key: KEY });
    expect(html).toContain("cid=SPN-octa-");
    expect(html).not.toContain("!");
  });

  it("says the campaign has not started when every window begins in the future", async () => {
    stubSponsor(OCTA, [{ country: "SG", since: "2099-01-01T00:00:00+00:00", until: null }]);
    const html = await renderSponsor({ key: KEY });
    expect(html).toContain("Counting starts when your campaign goes live.");
    expect(html).not.toContain("Showing");
    expect(html).toContain("cid=SPN-octa-");
  });

  it("404s on a wrong key exactly like an agency", async () => {
    stubSponsor();
    await expect(renderSponsor({ key: "0".repeat(64) })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("/partners/[slug]/export — a sponsor's CSVs", () => {
  const sreq = (qs: string) => new NextRequest(`https://app.test/partners/octa/export${qs}`);

  it("serves the masked client table", async () => {
    stubSponsor();
    const res = await GET(sreq(`?key=${KEY}&table=clients`), { params: Promise.resolve({ slug: "octa" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain('filename="octa-clients-');
    const lines = (await res.text()).trimEnd().split("\r\n");
    expect(lines[0]).toBe("signed_up,country,client,stage,ad,account_number,deposit_total");
    expect(lines[1]).toBe("2026-11-03,MY,Aisyah R.,Funded,Gold Hook 03,88123456,200.00");
    expect(lines[2]).toBe("2026-11-02,MY,Wei L.,Active in the app,,,");
  });

  it("serves the sponsor funnel by default", async () => {
    stubSponsor();
    const res = await GET(sreq(`?key=${KEY}`), { params: Promise.resolve({ slug: "octa" }) });
    expect(res.headers.get("Content-Disposition")).toContain('filename="octa-funnel-');
    const lines = (await res.text()).trimEnd().split("\r\n");
    expect(lines[0]).toBe("week,ad,signups,activated,upgrade_viewed,broker_clicked,submitted,funded,deposit_total");
    expect(lines[1]).toBe("2026-11-02,,120,50,30,12,4,2,350.00");
  });
});
