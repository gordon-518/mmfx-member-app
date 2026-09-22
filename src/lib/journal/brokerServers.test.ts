import { describe, it, expect } from "vitest";
import {
  isDemoServer,
  knownServersFor,
  normalizeServer,
  validateBrokerServer,
} from "./brokerServers";

const ok = (raw: string, broker: string) => validateBrokerServer(raw, broker);

describe("validateBrokerServer — the servers that really sync", () => {
  it("accepts the confirmed live servers", () => {
    expect(ok("DupoinMarkets-Real", "dupoin")).toEqual({ ok: true, server: "DupoinMarkets-Real" });
    expect(ok("Elev8-Real2", "elev8_octa")).toEqual({ ok: true, server: "Elev8-Real2" });
    expect(ok("OctaFX-Real", "elev8_octa")).toEqual({ ok: true, server: "OctaFX-Real" });
  });

  it("accepts the servers from Gordon's MT5 (22 Sep)", () => {
    expect(ok("DupoinInternational-Real", "dupoin")).toEqual({
      ok: true,
      server: "DupoinInternational-Real",
    });
    expect(ok("OctaFX-Real2", "elev8_octa")).toEqual({ ok: true, server: "OctaFX-Real2" });
  });

  it("accepts a server we haven't listed, typed by the member", () => {
    // Dupoin or Octa can add an entity or a numbered server at any time; a
    // member must never be locked out because our list is behind.
    expect(ok("DupoinInternational-Real2", "dupoin").ok).toBe(true);
    expect(ok("DupoinAsia-Live3", "dupoin").ok).toBe(true);
    expect(ok("Octa-Real4", "elev8_octa").ok).toBe(true);
  });

  it("still refuses a demo server the member typed themselves", () => {
    expect(ok("DupoinInternational-Demo", "dupoin").ok).toBe(false);
    expect(ok("Octa-Demo7", "elev8_octa").ok).toBe(false);
  });

  it("accepts numbered variants we haven't seen yet, so nobody is locked out", () => {
    expect(ok("Elev8-Real7", "elev8_octa").ok).toBe(true);
    expect(ok("Elev8-Live2", "elev8_octa").ok).toBe(true);
    expect(ok("Elev8-Real10", "elev8_octa").ok).toBe(true);
  });

  it("canonicalises casing so one server is one row", () => {
    expect(ok("dupoinmarkets-real", "dupoin")).toEqual({ ok: true, server: "DupoinMarkets-Real" });
    expect(ok("  OCTAFX-REAL ", "elev8_octa")).toEqual({ ok: true, server: "OctaFX-Real" });
  });

  it("strips MT5's access-server suffix, which members paste from the status bar", () => {
    expect(ok("DupoinMarkets-Real Access Server SG #1", "dupoin")).toEqual({
      ok: true,
      server: "DupoinMarkets-Real",
    });
    expect(normalizeServer("DupoinMarkets-Real - Access Server SG #2")).toBe("DupoinMarkets-Real");
  });
});

describe("validateBrokerServer — demo accounts are refused", () => {
  it.each(["Elev8-Demo2", "OctaFX-Demo", "DupoinMarkets-Demo", "MMFX-Demo"])("refuses %s", (s) => {
    const r = ok(s, "elev8_octa");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/demo server/i);
  });

  it("flags demo wording on its own", () => {
    expect(isDemoServer("Elev8-Demo2")).toBe(true);
    expect(isDemoServer("Elev8-Real2")).toBe(false);
  });
});

describe("validateBrokerServer — the junk members actually typed", () => {
  it.each([
    ["Anti DDos Proxy Server", "dupoin"],
    ["Access Server SG #1", "dupoin"],
    ["SG #2", "dupoin"],
    ["Dupoin", "dupoin"],
    ["DupoinMarkets", "dupoin"],
    ["Dupoin markets ltd", "dupoin"],
    ["Octa Markets Incorporated", "elev8_octa"],
  ])("refuses %s", (s, broker) => {
    expect(ok(s, broker).ok).toBe(false);
  });

  it("refuses the other broker's server", () => {
    expect(ok("DupoinMarkets-Real", "elev8_octa").ok).toBe(false);
    expect(ok("Elev8-Real2", "dupoin").ok).toBe(false);
  });

  it("asks for the server when it's blank or a fragment", () => {
    expect(ok("", "dupoin").ok).toBe(false);
    expect(ok("  ", "dupoin").ok).toBe(false);
    const r = ok("SG", "dupoin");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/MT5 login screen/);
  });

  it("names the right broker in the error", () => {
    const r = ok("whatever-real", "dupoin");
    if (!r.ok) expect(r.error).toContain("DupoinMarkets-Real");
  });
});

describe("knownServersFor", () => {
  it("offers suggestions per broker", () => {
    expect(knownServersFor("dupoin")).toEqual([
      "DupoinMarkets-Real",
      "DupoinInternational-Real",
    ]);
    expect(knownServersFor("elev8_octa")).toEqual([
      "Elev8-Real2",
      "OctaFX-Real2",
      "OctaFX-Real",
    ]);
    expect(knownServersFor("nope")).toEqual([]);
  });
});
