import { describe, it, expect } from "vitest";
import { friendlySyncError } from "./syncError";

describe("friendlySyncError", () => {
  it("returns null for no error", () => {
    expect(friendlySyncError(null)).toBeNull();
    expect(friendlySyncError(undefined)).toBeNull();
    expect(friendlySyncError("")).toBeNull();
  });

  it("hides MetaApi billing (the 'top up your account' leak) as an our-side issue", () => {
    const r = friendlySyncError(
      "To allow trading account deployment please top up your account. (b27ace1942ea435c91d8570f6964cee1)"
    );
    expect(r?.canReconnect).toBe(false);
    expect(r?.message).toMatch(/on our end/i);
    expect(r?.message.toLowerCase()).not.toContain("top up");
  });

  it("hides provisioning / database / infra errors", () => {
    for (const raw of [
      "Account has no MetaApi id",
      'duplicate key value violates unique constraint "journal_trades_pkey"',
      "MetaApi: request timed out",
      "fetch failed",
      "429 Too Many Requests",
      "new row violates row-level security policy",
    ]) {
      const r = friendlySyncError(raw);
      expect(r?.canReconnect, raw).toBe(false);
      expect(r?.message, raw).toMatch(/on our end/i);
    }
  });

  it("keeps genuine credential/broker failures actionable", () => {
    for (const raw of [
      "Invalid account credentials",
      "Authentication failed",
      "Broker denied by broker for this login",
      "The server rejected the login",
    ]) {
      const r = friendlySyncError(raw);
      expect(r?.canReconnect, raw).toBe(true);
      expect(r?.message, raw).toMatch(/investor password/i);
    }
  });

  it("defaults an ambiguous connect failure to the safe our-side message", () => {
    const r = friendlySyncError("Account did not connect (state DEPLOYING / DISCONNECTED)");
    expect(r?.canReconnect).toBe(false);
    expect(r?.message).toMatch(/on our end/i);
  });
});
