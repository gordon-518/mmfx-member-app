import { describe, it, expect } from "vitest";
import { memberPingHtml } from "./memberPing";
import type { MemberContext } from "./types";

const NOW = new Date("2026-09-28T00:00:00Z");

const base: MemberContext = {
  userId: "9dc9b21c-382e-4513-9655-5779296e95a1",
  matchedBy: "handle",
  tier: "foundation",
  trialEndsAt: null,
  email: "member@example.com",
  tradingAccount: "63453820",
  broker: "octa",
  depositTotal: 159.32,
  submission: { status: "pending", rejectReason: null, createdAt: "2026-09-24T10:52:00Z", amount: 370.28, broker: "octa" },
  attested: true,
};

describe("memberPingHtml", () => {
  it("carries what the admin needs to check both ends", () => {
    const h = memberPingHtml(base, NOW);
    expect(h).toContain("Foundation");
    expect(h).toContain("MM-9DC9B2");
    expect(h).toContain("member@example.com");
    expect(h).toContain("63453820");
    expect(h).toContain("octa");
    expect(h).toContain("$159.32 deposited");
    expect(h).toContain("pending");
    expect(h).toContain("$370.28");
    expect(h).toContain("2026-09-24");
    expect(h).toContain("app.marketmakersfx.net/admin");
  });

  it("says so when there is no account number or no submission", () => {
    const h = memberPingHtml({ ...base, tradingAccount: null, broker: null, depositTotal: 0, submission: null }, NOW);
    expect(h).toContain("no trading account on file");
    expect(h).toContain("none yet");
    expect(h).not.toContain("deposited");
  });

  it("shows a rejection reason and a running trial", () => {
    const h = memberPingHtml(
      {
        ...base,
        trialEndsAt: "2026-10-02T00:00:00Z",
        submission: { status: "rejected", rejectReason: "Screenshot unreadable", createdAt: "2026-09-20T00:00:00Z", amount: 60, broker: "dupoin" },
      },
      NOW
    );
    expect(h).toContain("rejected");
    expect(h).toContain("Screenshot unreadable");
    expect(h).toContain("Trial ends 2026-10-02");
  });

  it("hides an expired trial", () => {
    expect(memberPingHtml({ ...base, trialEndsAt: "2026-09-01T00:00:00Z" }, NOW)).not.toContain("Trial ends");
  });

  it("warns when the match is only the code they typed", () => {
    expect(memberPingHtml({ ...base, matchedBy: "ref", attested: false }, NOW)).toContain("check before acting");
    expect(memberPingHtml(base, NOW)).not.toContain("check before acting");
  });

  it("escapes HTML so a broker or email can't break the message", () => {
    const h = memberPingHtml({ ...base, email: "a<b>@x.com" }, NOW);
    expect(h).toContain("a&lt;b&gt;@x.com");
  });

  it("is empty when the chat isn't matched to a member", () => {
    expect(memberPingHtml(null, NOW)).toBe("");
  });
});
