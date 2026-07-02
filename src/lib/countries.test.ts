import { describe, it, expect } from "vitest";
import { COUNTRIES, countryName, isKnownCountry } from "./countries";

describe("countries", () => {
  it("has a substantial list", () => {
    expect(COUNTRIES.length).toBeGreaterThan(150);
  });
  it("every code is a unique 2-letter uppercase", () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(c).toMatch(/^[A-Z]{2}$/);
  });
  it("includes the core MMFX geos", () => {
    for (const code of ["MY", "ID", "US", "GB", "SG"]) {
      expect(isKnownCountry(code)).toBe(true);
    }
  });
  it("countryName resolves and is case-insensitive", () => {
    expect(countryName("MY")).toBe("Malaysia");
    expect(countryName("my")).toBe("Malaysia");
  });
  it("countryName falls back to the code when unknown, empty for nullish", () => {
    expect(countryName("ZZ")).toBe("ZZ");
    expect(countryName(null)).toBe("");
  });
});
