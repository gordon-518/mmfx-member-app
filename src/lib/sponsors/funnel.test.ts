import { describe, expect, it, vi } from "vitest";
import {
  byAd,
  byWeek,
  clientsCsv,
  fetchAllSponsorClients,
  fetchSponsorClients,
  fetchSponsorFunnel,
  funnelCsv,
  parsePage,
  parseSponsorRange,
  parseStage,
  shapeClientRow,
  shapeFunnelRow,
  STAGE_LABEL,
  totals,
  type SponsorFunnelRow,
} from "./funnel";

const row = (over: Partial<SponsorFunnelRow>): SponsorFunnelRow => ({
  week: "2026-11-02",
  label: null,
  signups: 0,
  activated: 0,
  upgradeViewed: 0,
  brokerClicked: 0,
  submitted: 0,
  funded: 0,
  depositTotal: 0,
  ...over,
});

const ROWS: SponsorFunnelRow[] = [
  row({ week: "2026-11-02", signups: 120, activated: 50, upgradeViewed: 30, brokerClicked: 12, submitted: 4, funded: 2, depositTotal: 350 }),
  row({ week: "2026-11-02", label: "Gold Hook 03", signups: 40, activated: 25, upgradeViewed: 15, brokerClicked: 6, submitted: 2, funded: 1, depositTotal: 200 }),
  row({ week: "2026-11-09", label: "Gold Hook 03", signups: 10, activated: 5, funded: 0 }),
  row({ week: "2026-11-09", label: "Quiet Ad", signups: 30, activated: 2, funded: 1, depositTotal: 50.5 }),
];

describe("shapeFunnelRow", () => {
  it("reads the RPC's snake_case row, numerics as strings included", () => {
    expect(
      shapeFunnelRow({ week: "2026-11-02T00:00:00", label: null, signups: "120", activated: 50, upgrade_viewed: "30", broker_clicked: 12, submitted: 4, funded: 2, deposit_total: "350.00" })
    ).toEqual(row({ signups: 120, activated: 50, upgradeViewed: 30, brokerClicked: 12, submitted: 4, funded: 2, depositTotal: 350 }));
  });
  it("treats an empty label as untraced", () => {
    expect(shapeFunnelRow({ week: "2026-11-02", label: "" }).label).toBeNull();
  });
});

describe("totals", () => {
  it("sums every stage and counts traced signups from labelled rows only", () => {
    const t = totals(ROWS);
    expect(t.signups).toBe(200);
    expect(t.traced).toBe(80);
    expect(t.activated).toBe(82);
    expect(t.upgradeViewed).toBe(45);
    expect(t.brokerClicked).toBe(18);
    expect(t.submitted).toBe(6);
    expect(t.funded).toBe(4);
    expect(t.depositTotal).toBe(600.5);
    expect(t.fundedRate).toBe(2);
  });
  it("has a zero rate with no signups", () => {
    expect(totals([]).fundedRate).toBe(0);
  });
});

describe("byWeek / byAd", () => {
  it("groups by week, oldest first, traced and untraced together", () => {
    const w = byWeek(ROWS);
    expect(w.map((x) => x.week)).toEqual(["2026-11-02", "2026-11-09"]);
    expect(w[0].signups).toBe(160);
    expect(w[0].traced).toBe(40);
    expect(w[1].signups).toBe(40);
  });
  it("lists traced ads only, best-funded first, then by signups", () => {
    const a = byAd(ROWS);
    expect(a.map((x) => x.label)).toEqual(["Gold Hook 03", "Quiet Ad"]);
    expect(a[0]).toEqual({ label: "Gold Hook 03", signups: 50, activated: 30, funded: 1, depositTotal: 200 });
  });
});

describe("stages", () => {
  it("parses a known stage and falls back to signed_up", () => {
    expect(parseStage("funded")).toBe("funded");
    expect(parseStage("nonsense")).toBe("signed_up");
    expect(parseStage(undefined)).toBe("signed_up");
  });
  it("has a plain label for every stage", () => {
    expect(STAGE_LABEL.broker_clicked).toBe("Clicked the broker link");
    expect(STAGE_LABEL.funded).toBe("Funded");
  });
});

describe("shapeClientRow", () => {
  it("keeps the masked columns and the window total", () => {
    const { row: r, total } = shapeClientRow({
      total: "2",
      signed_up: "2026-11-03",
      country: "MY",
      display: "Aisyah R.",
      stage: "funded",
      ad_label: "Gold Hook 03",
      account_number: "88123456",
      deposit_total: "200.00",
    });
    expect(total).toBe(2);
    expect(r).toEqual({
      signedUp: "2026-11-03",
      country: "MY",
      display: "Aisyah R.",
      stage: "funded",
      adLabel: "Gold Hook 03",
      accountNumber: "88123456",
      depositTotal: 200,
    });
  });
  it("keeps nulls null — an unfunded person has no account number and no deposit", () => {
    const { row: r } = shapeClientRow({ total: 1, signed_up: "2026-11-02", country: "MY", display: null, stage: "activated", ad_label: null, account_number: null, deposit_total: null });
    expect(r.display).toBeNull();
    expect(r.accountNumber).toBeNull();
    expect(r.depositTotal).toBeNull();
  });
});

describe("parseSponsorRange", () => {
  const now = new Date("2026-12-01T00:00:00Z");
  const start = new Date("2026-11-01T00:00:00Z");
  it("defaults to the whole deal", () => {
    const r = parseSponsorRange({}, start, now);
    expect(r.preset).toBe("all");
    expect(r.since).toEqual(start);
    expect(r.until).toEqual(now);
  });
  it("honours a day preset", () => {
    const r = parseSponsorRange({ days: "7" }, start, now);
    expect(r.preset).toBe(7);
    expect(r.since).toEqual(new Date("2026-11-24T00:00:00Z"));
  });
  it("ignores an unknown preset", () => {
    expect(parseSponsorRange({ days: "12" }, start, now).preset).toBe("all");
  });
  it("falls back to 90 days when no window is on file", () => {
    expect(parseSponsorRange({}, null, now).since).toEqual(new Date("2026-09-02T00:00:00Z"));
  });
});

describe("parsePage", () => {
  it("accepts a positive integer and otherwise answers 1", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("x")).toBe(1);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage(["2", "9"])).toBe(2);
  });
});

describe("the RPC wrappers", () => {
  const args = { slug: "octa", since: new Date("2026-11-01T00:00:00Z"), until: new Date("2026-12-01T00:00:00Z") };

  it("passes the range to fn_sponsor_funnel and shapes the rows", async () => {
    const rpc = vi.fn(async () => ({ data: [{ week: "2026-11-02", label: null, signups: 3 }], error: null }));
    const rows = await fetchSponsorFunnel({ rpc }, args);
    expect(rpc).toHaveBeenCalledWith("fn_sponsor_funnel", {
      p_slug: "octa",
      p_since: "2026-11-01T00:00:00.000Z",
      p_until: "2026-12-01T00:00:00.000Z",
    });
    expect(rows[0].signups).toBe(3);
  });

  it("answers [] on an error so the page renders empty rather than broken", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "boom" } }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await fetchSponsorFunnel({ rpc }, args)).toEqual([]);
    spy.mockRestore();
  });

  it("pages clients 50 at a time and reports the page count", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ total: 120, signed_up: "2026-11-03", country: "MY", display: "A B.", stage: "signed_up", ad_label: null, account_number: null, deposit_total: null }],
      error: null,
    }));
    const page = await fetchSponsorClients({ rpc }, { ...args, page: 3 });
    expect(rpc).toHaveBeenCalledWith("fn_sponsor_clients", expect.objectContaining({ p_limit: 50, p_offset: 100 }));
    expect(page).toMatchObject({ total: 120, page: 3, pages: 3 });
    expect(page.rows[0].display).toBe("A B.");
  });

  it("walks every page for the CSV and stops on a short page", async () => {
    const full = Array.from({ length: 200 }, (_, i) => ({ total: 250, signed_up: "2026-11-03", country: "MY", display: `P ${i}.`, stage: "signed_up", ad_label: null, account_number: null, deposit_total: null }));
    const rest = full.slice(0, 50);
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: full, error: null })
      .mockResolvedValueOnce({ data: rest, error: null });
    const rows = await fetchAllSponsorClients({ rpc }, args);
    expect(rows).toHaveLength(250);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_limit: 200, p_offset: 200 });
  });
});

describe("CSV", () => {
  it("writes the funnel with an ad column, blank when untraced", () => {
    const lines = funnelCsv(ROWS.slice(0, 2)).trimEnd().split("\r\n");
    expect(lines[0]).toBe("week,ad,signups,activated,upgrade_viewed,broker_clicked,submitted,funded,deposit_total");
    expect(lines[1]).toBe("2026-11-02,,120,50,30,12,4,2,350.00");
    expect(lines[2]).toBe("2026-11-02,Gold Hook 03,40,25,15,6,2,1,200.00");
  });
  it("writes the masked client table with plain stage words", () => {
    const lines = clientsCsv([
      { signedUp: "2026-11-03", country: "MY", display: "Aisyah R.", stage: "funded", adLabel: "Gold Hook 03", accountNumber: "88123456", depositTotal: 200 },
      { signedUp: "2026-11-02", country: "MY", display: null, stage: "activated", adLabel: null, accountNumber: null, depositTotal: null },
    ]).trimEnd().split("\r\n");
    expect(lines[0]).toBe("signed_up,country,client,stage,ad,account_number,deposit_total");
    expect(lines[1]).toBe("2026-11-03,MY,Aisyah R.,Funded,Gold Hook 03,88123456,200.00");
    expect(lines[2]).toBe("2026-11-02,MY,,Active in the app,,,");
  });
  it("neutralises a formula-shaped ad name", () => {
    expect(funnelCsv([row({ label: "=cmd|x" })])).toContain("'=cmd|x");
  });
});
