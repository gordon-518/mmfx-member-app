import { describe, expect, it } from "vitest";
import { serverMatchesBroker } from "./ibBrokers";

describe("serverMatchesBroker", () => {
  it("accepts a matching server", () => {
    expect(serverMatchesBroker("Elev8-Demo2", "elev8_octa")).toBe(true);
    expect(serverMatchesBroker("Dupoin-Live", "dupoin")).toBe(true);
  });
  it("rejects a clearly-mismatched server", () => {
    expect(serverMatchesBroker("Dupoin-Live", "elev8_octa")).toBe(false);
  });
  it("is lenient when the server names no known broker", () => {
    expect(serverMatchesBroker("MT5-Server-01", "dupoin")).toBe(true);
  });
});
