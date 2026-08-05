import { describe, it, expect } from "vitest";
import { resolveDestination } from "@/lib/channel/destinations";

describe("resolveDestination", () => {
  it("resolves an allowlisted slug to its app URL", () => {
    expect(resolveDestination("signup")).toBe("https://app.marketmakersfx.net/signup");
    expect(resolveDestination("indicators")).toBe("https://app.marketmakersfx.net/indicators");
  });
  it("returns null for an unknown slug (no open redirect)", () => {
    expect(resolveDestination("evil.com")).toBeNull();
    expect(resolveDestination("../admin")).toBeNull();
  });
});
