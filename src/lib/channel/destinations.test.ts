import { describe, it, expect } from "vitest";
import { resolveDestination, isAppDestination } from "@/lib/channel/destinations";

describe("resolveDestination", () => {
  it("resolves an allowlisted slug to its app URL", () => {
    expect(resolveDestination("signup")).toBe("https://app.marketmakersfx.net/signup");
    expect(resolveDestination("indicators")).toBe("https://app.marketmakersfx.net/indicators");
  });
  it("returns null for an unknown slug (no open redirect)", () => {
    expect(resolveDestination("evil.com")).toBeNull();
    expect(resolveDestination("../admin")).toBeNull();
  });

  it("resolves an allowlisted EXTERNAL url as-is (TeamMM deep link)", () => {
    expect(resolveDestination("teammm")).toBe("https://t.me/m/FtwoPlcaMjFl");
  });
  it("distinguishes app destinations from external ones", () => {
    expect(isAppDestination("signup")).toBe(true);
    expect(isAppDestination("teammm")).toBe(false);
    expect(isAppDestination("nope")).toBe(false);
  });

  it("resolves the AI assistant (journal) destination", () => {
    expect(resolveDestination("journal")).toBe("https://app.marketmakersfx.net/journal");
  });
});
