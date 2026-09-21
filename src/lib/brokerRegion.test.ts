import { describe, it, expect } from "vitest";
import { regionFor, DUPOIN_COUNTRIES } from "./brokerRegion";
import { OCTA_SIGNUP, IB_NUMBER, BOT_LINK } from "./brokerLinks";

describe("regionFor", () => {
  it("sends the US and UK to the contact path", () => {
    expect(regionFor("US")).toBe("contact");
    expect(regionFor("GB")).toBe("contact");
  });
  it("sends Dupoin countries to Dupoin", () => {
    for (const c of ["SG", "PH", "JP", "CA", "DE", "NO"]) expect(regionFor(c)).toBe("dupoin");
    expect(DUPOIN_COUNTRIES.has("MY")).toBe(false);
  });
  it("sends everyone else, including unknown, to Octa/Elev8", () => {
    expect(regionFor("MY")).toBe("octa");
    expect(regionFor("NG")).toBe("octa");
    expect(regionFor("")).toBe("octa");
  });
});

describe("brokerLinks", () => {
  it("the Octa signup link carries our IB", () => {
    expect(IB_NUMBER).toBe("47807426");
    expect(OCTA_SIGNUP).toContain(`ib=${IB_NUMBER}`);
  });
  it("the bot link opens @marketmakers18bot", () => {
    expect(BOT_LINK).toBe("https://t.me/marketmakers18bot");
  });
});
