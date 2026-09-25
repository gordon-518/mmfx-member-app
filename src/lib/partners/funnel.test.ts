import { describe, expect, it, vi } from "vitest";
import {
  byLabel,
  byWeek,
  csvField,
  fetchFunnel,
  fmtWeek,
  parseRange,
  parseRule,
  shapeRow,
  toCsv,
  totals,
  type FunnelRow,
} from "./funnel";

function row(p: Partial<FunnelRow>): FunnelRow {
  return {
    week: "2026-09-21",
    label: "hook",
    signups: 0,
    activated: 0,
    funded: 0,
    depositTotal: 0,
    firstTouchSignups: 0,
    firstTouchFunded: 0,
    ...p,
  };
}

describe("parseRule", () => {
  it("defaults to the rule the contract pays on", () => {
    expect(parseRule(undefined)).toBe("last_paid_7d");
    expect(parseRule("nonsense")).toBe("last_paid_7d");
    expect(parseRule("last_paid_7d")).toBe("last_paid_7d");
  });

  it("takes the first-touch toggle", () => {
    expect(parseRule("first")).toBe("first");
  });
});

describe("parseRange", () => {
  const now = new Date("2026-09-25T12:00:00Z");

  it("defaults to 30 days", () => {
    const r = parseRange({}, now);
    expect(r.days).toBe(30);
    expect(r.until).toEqual(now);
    expect(r.since.toISOString()).toBe("2026-08-26T12:00:00.000Z");
  });

  it("takes the 7 / 30 / 90 presets and nothing else", () => {
    expect(parseRange({ days: "7" }, now).days).toBe(7);
    expect(parseRange({ days: "90" }, now).days).toBe(90);
    expect(parseRange({ days: "45" }, now).days).toBe(30);
    expect(parseRange({ days: "abc" }, now).days).toBe(30);
  });

  it("takes a custom since/until pair", () => {
    const r = parseRange({ since: "2026-09-01", until: "2026-09-15" }, now);
    expect(r.days).toBeNull();
    expect(r.since.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(r.until.toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });

  it("falls back to the default rather than erroring on a bad custom range", () => {
    // A partner mistyping a date should see the usual dashboard.
    expect(parseRange({ since: "yesterday", until: "today" }, now).days).toBe(30);
    // Backwards range: until must be after since.
    expect(parseRange({ since: "2026-09-15", until: "2026-09-01" }, now).days).toBe(30);
  });
});

describe("shapeRow", () => {
  it("reads the RPC's snake_case columns", () => {
    expect(
      shapeRow({
        week: "2026-09-21",
        label: "Gold Hook 03",
        signups: 12,
        activated: 7,
        funded: 2,
        deposit_total: 900,
        first_touch_signups: 11,
        first_touch_funded: 3,
      })
    ).toEqual({
      week: "2026-09-21",
      label: "Gold Hook 03",
      signups: 12,
      activated: 7,
      funded: 2,
      depositTotal: 900,
      firstTouchSignups: 11,
      firstTouchFunded: 3,
    });
  });

  it("copes with numeric arriving as a string", () => {
    expect(shapeRow({ deposit_total: "1234.50" }).depositTotal).toBe(1234.5);
    expect(shapeRow({ deposit_total: null }).depositTotal).toBe(0);
  });
});

describe("fetchFunnel", () => {
  const args = {
    slug: "ren",
    since: new Date("2026-08-26T00:00:00Z"),
    until: new Date("2026-09-25T00:00:00Z"),
    rule: "last_paid_7d" as const,
  };

  it("passes the slug, the window and the rule through to the RPC", async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    await fetchFunnel({ rpc }, args);
    expect(rpc).toHaveBeenCalledWith("fn_partner_funnel", {
      p_slug: "ren",
      p_since: "2026-08-26T00:00:00.000Z",
      p_until: "2026-09-25T00:00:00.000Z",
      p_rule: "last_paid_7d",
    });
  });

  it("passes p_rule = first when the toggle is flipped", async () => {
    const rpc = vi.fn(async (fn: string, a: Record<string, unknown>) => {
      void fn;
      void a;
      return { data: [], error: null };
    });
    await fetchFunnel({ rpc }, { ...args, rule: "first" });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_rule: "first" });
  });

  it("returns [] rather than throwing when the RPC fails", async () => {
    const failing = vi.fn(async () => ({ data: null, error: { message: "denied" } }));
    await expect(fetchFunnel({ rpc: failing }, args)).resolves.toEqual([]);

    const thrower = vi.fn(async () => {
      throw new Error("network down");
    });
    await expect(fetchFunnel({ rpc: thrower }, args)).resolves.toEqual([]);
  });
});

describe("totals", () => {
  it("adds the columns and derives the funded rate", () => {
    const t = totals([
      row({ signups: 10, activated: 6, funded: 1, depositTotal: 500 }),
      row({ signups: 30, activated: 9, funded: 3, depositTotal: 1500.5 }),
    ]);
    expect(t.signups).toBe(40);
    expect(t.funded).toBe(4);
    expect(t.depositTotal).toBe(2000.5);
    expect(t.fundedRate).toBe(10);
  });

  it("reads zero signups as a zero rate, not a division by zero", () => {
    expect(totals([]).fundedRate).toBe(0);
  });
});

describe("byLabel", () => {
  const rows = [
    row({ week: "2026-09-07", label: "quiet", signups: 40 }),
    row({ week: "2026-09-14", label: "quiet", signups: 20 }),
    row({ week: "2026-09-07", label: "winner", signups: 5, funded: 3 }),
    row({ week: "2026-09-14", label: "winner", signups: 6, funded: 1 }),
  ];

  it("sorts by funded first, then signups — the ad that pays, not the ad that clicks", () => {
    expect(byLabel(rows).map((r) => r.label)).toEqual(["winner", "quiet"]);
    expect(byLabel(rows)[0].funded).toBe(4);
  });

  it("gives every ad the same weekly buckets, so the sparklines line up", () => {
    const out = byLabel(rows);
    expect(out.find((r) => r.label === "quiet")!.weekly).toEqual([40, 20]);
    expect(out.find((r) => r.label === "winner")!.weekly).toEqual([5, 6]);
  });

  it("fills a week an ad did not run with a zero", () => {
    const out = byLabel([
      row({ week: "2026-09-07", label: "a", signups: 3 }),
      row({ week: "2026-09-14", label: "b", signups: 4 }),
    ]);
    expect(out.find((r) => r.label === "a")!.weekly).toEqual([3, 0]);
    expect(out.find((r) => r.label === "b")!.weekly).toEqual([0, 4]);
  });
});

describe("byWeek", () => {
  it("collapses the ads into one row per week, oldest first", () => {
    const out = byWeek([
      row({ week: "2026-09-14", label: "a", signups: 2 }),
      row({ week: "2026-09-07", label: "a", signups: 5 }),
      row({ week: "2026-09-07", label: "b", signups: 1, funded: 1 }),
    ]);
    expect(out.map((r) => r.week)).toEqual(["2026-09-07", "2026-09-14"]);
    expect(out[0].signups).toBe(6);
    expect(out[0].funded).toBe(1);
  });
});

describe("csvField", () => {
  it("leaves an ordinary value alone", () => {
    expect(csvField("Gold Hook 03")).toBe("Gold Hook 03");
    expect(csvField(12)).toBe("12");
  });

  it("quotes commas, quotes and newlines the RFC 4180 way", () => {
    expect(csvField("MY, ID")).toBe('"MY, ID"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("two\nlines")).toBe('"two\nlines"');
  });

  it("defuses a value a spreadsheet would run as a formula", () => {
    // An ad name is free text. Excel and Sheets execute a cell starting with
    // = + - @, so the prefix is the difference between a report and a payload.
    expect(csvField("=1+1")).toBe("'=1+1");
    expect(csvField("+ver 2")).toBe("'+ver 2");
    expect(csvField("-50% off")).toBe("'-50% off");
    expect(csvField("@everyone")).toBe("'@everyone");
  });
});

describe("toCsv", () => {
  it("writes the header the dashboard's columns match", () => {
    expect(toCsv([]).split("\r\n")[0]).toBe(
      "week,label,signups,activated,funded,deposit_total,first_touch_signups,first_touch_funded"
    );
  });

  it("writes one line per row, with money at two decimals", () => {
    const csv = toCsv([
      row({ label: "Gold Hook, 03", signups: 12, activated: 7, funded: 2, depositTotal: 900.5 }),
    ]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('2026-09-21,"Gold Hook, 03",12,7,2,900.50,0,0');
  });

  it("ends with a newline so the last row survives an import", () => {
    expect(toCsv([row({})]).endsWith("\r\n")).toBe(true);
  });
});

describe("fmtWeek", () => {
  it("reads a week as a short UTC date", () => {
    // Node's ICU spells September "Sept" in en-GB; the point is the shape.
    expect(fmtWeek("2026-09-21")).toMatch(/^21 Sept?$/);
  });

  it("hands back anything it cannot parse", () => {
    expect(fmtWeek("not-a-date")).toBe("not-a-date");
  });
});
