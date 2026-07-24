import { describe, expect, it } from "vitest";
import { normalizeLogin, parseIbRows, type BrokerParseConfig } from "./ibParse";

const DUPOIN: BrokerParseConfig = { column: "Account", strip: [], split: false };
const OCTA: BrokerParseConfig = {
  column: "trading_account",
  strip: ["Octa_", "TA"],
  split: true,
};

describe("normalizeLogin", () => {
  it("returns digits unchanged when no strip", () => {
    expect(normalizeLogin("2130873", [])).toBe("2130873");
  });
  it("strips TA prefix", () => {
    expect(normalizeLogin("TA22444243", ["Octa_", "TA"])).toBe("22444243");
  });
  it("strips Octa_TA prefix (in order)", () => {
    expect(normalizeLogin("Octa_TA17236344", ["Octa_", "TA"])).toBe("17236344");
  });
  it("trims surrounding whitespace", () => {
    expect(normalizeLogin("  TA202422 ", ["Octa_", "TA"])).toBe("202422");
  });
  it("rejects a token that isn't digits after stripping", () => {
    expect(normalizeLogin("N/A", ["Octa_", "TA"])).toBeNull();
    expect(normalizeLogin("", [])).toBeNull();
  });
});

describe("parseIbRows", () => {
  it("parses Dupoin single-column numeric logins", () => {
    const rows = [{ Account: "2130873" }, { Account: "2043071" }];
    const out = parseIbRows(rows, DUPOIN);
    expect(out.logins).toEqual(["2130873", "2043071"]);
    expect(out.skipped).toBe(0);
  });
  it("splits + normalizes + dedupes Octa multi-account cells", () => {
    const rows = [
      { trading_account: " TA22444243,  TA202422" },
      { trading_account: "Octa_TA17236344, TA22444243" }, // dup 22444243
    ];
    const out = parseIbRows(rows, OCTA);
    expect(out.logins).toEqual(["22444243", "202422", "17236344"]);
  });
  it("counts unparseable tokens as skipped, keeps the good ones", () => {
    const rows = [{ trading_account: "TA100, junk, Octa_TA200" }];
    const out = parseIbRows(rows, OCTA);
    expect(out.logins).toEqual(["100", "200"]);
    expect(out.skipped).toBe(1);
  });
  it("ignores rows with an empty target column", () => {
    const rows = [{ Account: null }, { Account: "2130873" }];
    const out = parseIbRows(rows, DUPOIN);
    expect(out.logins).toEqual(["2130873"]);
  });
});
