import { describe, expect, it } from "vitest";
import { classifyMember } from "./ibMemberAudit";

describe("classifyMember", () => {
  it("flags not_under_ib when the login is absent from the allowlist", () => {
    expect(classifyMember({ underIb: false, dupoinBalance: null }, 50)).toBe(
      "not_under_ib"
    );
  });
  it("flags low_balance when a Dupoin balance is below the threshold", () => {
    expect(classifyMember({ underIb: true, dupoinBalance: 0.48 }, 50)).toBe(
      "low_balance"
    );
  });
  it("is ok at or above the threshold", () => {
    expect(classifyMember({ underIb: true, dupoinBalance: 100 }, 50)).toBe("ok");
    expect(classifyMember({ underIb: true, dupoinBalance: 50 }, 50)).toBe("ok");
  });
  it("is ok for an under-IB member with no balance (e.g. Octa)", () => {
    expect(classifyMember({ underIb: true, dupoinBalance: null }, 50)).toBe("ok");
  });
});
