import { describe, it, expect } from "vitest";
import { checkDraft, mustHandOff, MAX_REPLY_CHARS } from "./guard";
import { buildFactSheet, RISK_FOOTER } from "./facts";
import type { MemberContext, SupportSettings } from "./types";

const settings: SupportSettings = {
  enabled: true, bonus_code: "TeamMM001", bonus_code_expires: "2026-12-15",
  official_accounts: [{ handle: "MM_3000", label: "Admin Amelia" }, { handle: "MMFX_BOSS", label: "Gordon" }],
  office_hours: "x", trade_cadence: "y", notes: "", approved_flows: [],
};
const facts = buildFactSheet(settings, new Date("2026-09-15T04:00:00Z"));
const ctx = (memberTexts: string[] = [], member: MemberContext | null = null) => ({ facts, memberTexts, member });

describe("checkDraft", () => {
  it("passes a clean, correct reply", () => {
    expect(checkDraft("Foundation starts at $50, Desk at $200 and Team MM at $500. Start at https://app.marketmakersfx.net/upgrade", ctx())).toEqual([]);
  });
  it("blocks an amount that isn't on the fact sheet", () => {
    expect(checkDraft("The minimum is USD100.", ctx())).toEqual([expect.stringContaining("amount")]);
  });
  it("allows an amount the member wrote themselves", () => {
    expect(checkDraft("Your $198 counts toward Foundation.", ctx(["I have $198 in my account"]))).toEqual([]);
  });
  it("blocks a wrong IB number", () => {
    expect(checkDraft("Use IB 5928887.", ctx())).toEqual([expect.stringContaining("IB")]);
  });
  it("blocks a stale or unknown bonus code", () => {
    expect(checkDraft("Use code TeamMM002.", ctx())).toEqual([expect.stringContaining("bonus")]);
    expect(checkDraft("Use code TeamMM001.", ctx())).toEqual([]);
  });
  it("blocks links that aren't allowed", () => {
    expect(checkDraft("Fill this form https://forms.gle/abc", ctx())).toEqual([expect.stringContaining("link")]);
    expect(checkDraft("Sign up at clickto.trade/bIyal89D7os?ib=5928887", ctx())).toEqual(
      expect.arrayContaining([expect.stringContaining("link")]));
  });
  it("blocks unofficial handles", () => {
    expect(checkDraft("Message @randomguy", ctx())).toEqual([expect.stringContaining("@randomguy")]);
    expect(checkDraft("Message @MM_3000", ctx())).toEqual([]);
  });
  it("blocks profit language", () => {
    expect(checkDraft("Let's start printing together!", ctx())).toEqual([expect.stringContaining("profit")]);
  });
  it("blocks a deposit-approved claim without a verified submission", () => {
    expect(checkDraft("Your deposit is approved.", ctx())).toEqual([expect.stringContaining("deposit")]);
    const verified: MemberContext = { userId: "u", matchedBy: "ref", tier: "foundation", trialEndsAt: null,
      submission: { status: "verified", rejectReason: null, createdAt: "2026-09-14" } };
    expect(checkDraft("Your deposit is approved.", ctx([], verified))).toEqual([]);
  });
  it("blocks replies over the length limit", () => {
    expect(checkDraft("a".repeat(MAX_REPLY_CHARS + 1), ctx())).toEqual([expect.stringContaining("long")]);
  });

  // (a) Reference codes aren't IB numbers, even the ~6% that are all digits.
  it("does not treat a deposit reference code as an IB number or bonus code", () => {
    expect(checkDraft("Thanks, I've noted your reference MM-123456.", ctx())).toEqual([]);
  });

  // (b) Shared URL normaliser; trailing slashes don't cause false blocks.
  describe("link normalisation", () => {
    it("allows a trailing slash on an allowed app path", () => {
      expect(checkDraft("Head to https://app.marketmakersfx.net/upgrade/", ctx())).toEqual([]);
    });
    it("allows an allow-listed link even without its own trailing slash", () => {
      expect(checkDraft("Switch here: https://my.octabroker.com/change-partner-request", ctx())).toEqual([]);
    });
    it("blocks an app path that isn't on the fact sheet", () => {
      expect(checkDraft("Go to https://app.marketmakersfx.net/admin", ctx())).toEqual([expect.stringContaining("link")]);
    });
  });

  // (c) Profit language: risk footer and negations are allowed; the reason names the word.
  describe("profit language exceptions and naming", () => {
    it("allows a reply that quotes the risk footer verbatim", () => {
      expect(checkDraft(`Foundation starts at $50. ${RISK_FOOTER}`, ctx())).toEqual([]);
    });
    it("allows a negated guarantee", () => {
      expect(checkDraft("Nothing is guaranteed in trading.", ctx())).toEqual([]);
    });
    it("names the matched word and still flags it as profit language", () => {
      const result = checkDraft("Profits are guaranteed", ctx());
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("profit");
      expect(result[0]).toMatch(/Profits/i);
    });
    it("blocks return-rate language", () => {
      expect(checkDraft("returns of 10% a month", ctx())).toEqual([expect.stringContaining("profit")]);
    });
  });

  // (d) Other bonus-code shapes.
  describe("other bonus-code shapes", () => {
    it("blocks an unknown code in the generic shape", () => {
      expect(checkDraft("Use code WELCOME50.", ctx())).toEqual([expect.stringContaining("bonus")]);
    });
    it("still allows the current bonus code (no double failure)", () => {
      expect(checkDraft("Use code TeamMM001.", ctx())).toEqual([]);
    });
    it("does not mistake a reference code for a bonus code", () => {
      expect(checkDraft("Your reference code MM-3F9A2C is noted.", ctx())).toEqual([]);
    });
    it("blocks the bonus code once it has expired", () => {
      const expired = buildFactSheet(settings, new Date("2026-12-16T04:00:00Z"));
      expect(checkDraft("Use code TeamMM001.", { facts: expired, memberTexts: [], member: null }))
        .toEqual([expect.stringContaining("bonus")]);
    });
  });

  // (e) Handles: an email address is never mistaken for a handle.
  it("does not treat an email address as a handle", () => {
    expect(checkDraft("Contact me@example.com", ctx())).toEqual([]);
  });

  // (f) Consistency: every fact stated in the text is itself allowed.
  it("keeps the fact text and the allow-list consistent", () => {
    const urls = facts.text.match(/\bhttps?:\/\/[^\s)>\]]+/g) ?? [];
    const handles = [...facts.text.matchAll(/(^|[^\w@])@([A-Za-z0-9_]{3,32})/g)].map((m) => `@${m[2]}`);
    const amounts = facts.text.match(/\$\d[\d,]*(?:\.\d+)?|USD\s?\d[\d,]*(?:\.\d+)?/gi) ?? [];
    for (const item of [...urls, ...handles, ...amounts]) {
      expect(checkDraft(item, ctx())).toEqual([]);
    }
  });

  // Self-review: normal correct replies must not false-positive.
  describe("no false positives on ordinary correct replies", () => {
    it("allows a dollar amount at the end of a sentence", () => {
      expect(checkDraft("Foundation starts at $50", ctx())).toEqual([]);
    });
    it("allows an allow-listed link with a trailing full stop", () => {
      expect(checkDraft("Go to https://app.marketmakersfx.net/upgrade.", ctx())).toEqual([]);
    });
    it("allows an official handle followed by a comma", () => {
      expect(checkDraft("Message @MM_3000, they'll help.", ctx())).toEqual([]);
    });
    it("does not treat a hyphenated date as an IB number", () => {
      expect(checkDraft("The bonus code is valid until 2026-12-15.", ctx())).toEqual([]);
    });
    it("does not treat an indicator count as a dollar amount", () => {
      expect(checkDraft("You'll get 10 TradingView indicators.", ctx())).toEqual([]);
    });
  });
});

describe("mustHandOff", () => {
  it("hands off money, disputes and deletion whatever the draft", () => {
    expect(mustHandOff("How do I withdraw my money?", "other")).toMatch(/withdraw/);
    expect(mustHandOff("I paid USD 588 yesterday, where is my access?", "lifetime")).toMatch(/payment/);
    expect(mustHandOff("This is a scam, I'll report you", "complaint")).toBeTruthy();
    expect(mustHandOff("please delete my account", "deletion")).toBeTruthy();
  });
  it("leaves ordinary questions alone", () => {
    expect(mustHandOff("How much do I need to deposit?", "plans")).toBeNull();
  });
});
