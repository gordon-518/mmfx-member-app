import { describe, it, expect } from "vitest";
import { isClientEvent, sanitizeClientProps } from "./eventNames";

describe("isClientEvent", () => {
  it("accepts only the two browser-originated click events", () => {
    expect(isClientEvent("upgrade_broker_link_clicked")).toBe(true);
    expect(isClientEvent("upgrade_contact_clicked")).toBe(true);
  });
  it("rejects server-only events, so a browser can't forge them", () => {
    expect(isClientEvent("deposit_verified")).toBe(false);
    expect(isClientEvent("feature_view")).toBe(false);
    expect(isClientEvent("upgrade_viewed")).toBe(false);
  });
  it("rejects non-strings and unknown names", () => {
    expect(isClientEvent(undefined)).toBe(false);
    expect(isClientEvent(42)).toBe(false);
    expect(isClientEvent("drop table")).toBe(false);
  });
});

describe("sanitizeClientProps", () => {
  it("keeps a valid broker and flow on a broker click", () => {
    expect(
      sanitizeClientProps("upgrade_broker_link_clicked", { broker: "octa", flow: "new" })
    ).toEqual({ broker: "octa", flow: "new" });
  });
  it("drops unknown values and foreign keys on a broker click", () => {
    expect(
      sanitizeClientProps("upgrade_broker_link_clicked", {
        broker: "binance",
        flow: "switch",
        channel: "whatsapp",
        amount: 5000,
      })
    ).toEqual({ flow: "switch" });
  });
  it("keeps only a valid channel on a contact click", () => {
    expect(
      sanitizeClientProps("upgrade_contact_clicked", { channel: "telegram", broker: "octa" })
    ).toEqual({ channel: "telegram" });
    expect(sanitizeClientProps("upgrade_contact_clicked", { channel: "email" })).toEqual({});
  });
  it("tolerates a missing or non-object payload", () => {
    expect(sanitizeClientProps("upgrade_contact_clicked", null)).toEqual({});
    expect(sanitizeClientProps("upgrade_broker_link_clicked", "octa")).toEqual({});
  });
});
