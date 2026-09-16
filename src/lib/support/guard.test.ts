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
      // Was "returns of 10% a month", which only proved the word "returns"
      // matches. This proves the rate pattern itself (I3).
      expect(checkDraft("10% a month is realistic", ctx())).toEqual([expect.stringContaining("profit")]);
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
    // T1: don't pass vacuously — the fact sheet must actually contain these.
    expect(urls.length).toBeGreaterThan(0);
    expect(handles.length).toBeGreaterThan(0);
    expect(amounts.length).toBeGreaterThan(0);
    for (const item of [...urls, ...handles, ...amounts]) {
      expect(checkDraft(item, ctx())).toEqual([]);
    }
  });

  // T2: the strongest version of (f) — the whole fact sheet, verbatim, must
  // pass every rule in one pass (it's long enough to trip "too long").
  it("passes the entire fact sheet text through every rule", () => {
    expect(checkDraft(facts.text, ctx()).filter((r) => !r.startsWith("too long"))).toEqual([]);
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

  // C1: a wrong IB with separators ("592 8887", "5,928,887") must not slip past.
  describe("separator-tolerant IB scan", () => {
    it("blocks a wrong IB written with spaces", () => {
      expect(checkDraft("Use IB 592 8887.", ctx())).toEqual([expect.stringContaining("IB")]);
    });
    it("blocks a wrong IB written with commas", () => {
      expect(checkDraft("Use IB 5,928,887.", ctx())).toEqual([expect.stringContaining("IB")]);
    });
    it("does not treat a date as an IB number", () => {
      expect(checkDraft("The offer runs until 2026-12-15.", ctx())).toEqual([]);
    });
    it("does not treat a comma amount as an IB number", () => {
      expect(checkDraft("The lifetime plan is $1,588.", ctx())).toEqual([]);
    });
  });

  // C2: a schemeless link outside the old hard-coded domain list must still be caught.
  describe("generic schemeless link scan", () => {
    it("blocks a schemeless link to an unknown domain", () => {
      expect(checkDraft("Go to evil-signals.com/pay now.", ctx())).toEqual([expect.stringContaining("link")]);
    });
    it("blocks a schemeless shortlink", () => {
      expect(checkDraft("Go to bit.ly/abc", ctx())).toEqual([expect.stringContaining("link")]);
    });
    it("does not treat ordinary prose as a link", () => {
      expect(checkDraft("Foundation starts at $50.", ctx())).toEqual([]);
    });
  });

  // I1: a member's own account number must not be blocked as an IB.
  it("does not block a member's own account number as an IB", () => {
    expect(checkDraft("Your trading account 2167136 is linked.", ctx(["my account 2167136"]))).toEqual([]);
  });

  // I2: deposit-claim rule — negated/conditional phrasing must pass, a
  // promise to approve must always block, and the plan's original behaviour
  // (a bare "approved" claim needs a verified submission) is kept.
  describe("deposit-claim rule", () => {
    it("allows a negated approval claim", () => {
      expect(checkDraft("Your top-up hasn't been approved yet.", ctx())).toEqual([]);
    });
    it("allows a negated approval claim with 'not'", () => {
      expect(checkDraft("Your deposit is not approved yet.", ctx())).toEqual([]);
    });
    it("allows a negated verification claim", () => {
      expect(checkDraft("Your submission is pending, not verified yet.", ctx())).toEqual([]);
    });
    it("allows the fact sheet's own conditional phrasing", () => {
      expect(checkDraft("The team will check your submission and email you once it's approved.", ctx())).toEqual([]);
    });
    it("blocks a promise that someone will approve it, even with a verified submission", () => {
      const verified: MemberContext = {
        userId: "u", matchedBy: "ref", tier: "foundation", trialEndsAt: null,
        submission: { status: "verified", rejectReason: null, createdAt: "2026-09-14" },
      };
      expect(checkDraft("Amelia will approve your deposit today.", ctx())).toEqual([expect.stringContaining("promise")]);
      expect(checkDraft("Amelia will approve your deposit today.", ctx([], verified))).toEqual([expect.stringContaining("promise")]);
    });
  });

  // I3: profit language must catch the common phrasings the old regex missed.
  describe("wider profit language", () => {
    it.each([
      "You'll earn more.",
      "extra income monthly",
      "10% a month",
      "win every trade",
      "gains of 5%",
      "ROI is strong",
      "passive income",
    ])("blocks %s", (text) => {
      expect(checkDraft(text, ctx())).toEqual([expect.stringContaining("profit")]);
    });
    it("does not fire on the fact sheet's deposit bonus language", () => {
      expect(checkDraft("Dupoin's 100% deposit bonus is shown in the app.", ctx())).toEqual([]);
    });
  });

  // I4: CODE_RE must catch the common shapes it used to miss, without
  // mistaking a reference code or ordinary prose for a pasted code.
  describe("wider bonus-code scan", () => {
    it.each([
      "The code is SUMMER2026.",
      "Use promo XYZ99 at signup.",
      "Use code WELCOME.",
    ])("blocks %s", (text) => {
      expect(checkDraft(text, ctx())).toEqual([expect.stringContaining("bonus")]);
    });
    it("does not treat a stripped reference code's leftover text as a code", () => {
      expect(checkDraft("Your reference code MM-3F9A2C is noted.", ctx())).toEqual([]);
    });
    it("does not treat a following lowercase word as a code", () => {
      expect(checkDraft("I'll send the code shortly.", ctx())).toEqual([]);
      expect(checkDraft("the code you received by email", ctx())).toEqual([]);
    });
  });

  // I6: non-USD currencies and spaced separators.
  describe("currency and separator handling", () => {
    it("blocks an invented ringgit figure", () => {
      const result = checkDraft("Deposit RM250.", ctx());
      expect(result).toEqual([expect.stringContaining("amount")]);
      expect(result[0]).toContain("RM250");
    });
    it("parses a space-separated amount instead of reporting 0", () => {
      const result = checkDraft("The fee is 1 000 USD.", ctx());
      expect(result).toEqual([expect.stringContaining("amount")]);
      expect(result[0]).toContain("1000");
      expect(result[0]).not.toContain(": 0");
    });
  });

  // M2: repeated identical failures collapse to one, and reasons are capped.
  describe("dedupe and cap", () => {
    it("collapses a repeated handle failure to one reason", () => {
      expect(checkDraft("Ask @randomguy or @randomguy again.", ctx())).toEqual([expect.stringContaining("@randomguy")]);
    });
    it("caps the number of reasons fed back", () => {
      const draft =
        "Use IB 5928887 or 592 8887. Pay USD999 or RM250. Use code WELCOME99. " +
        "Go to evil-signals.com/pay now. Message @randomguy or @randomguy again. " +
        "We guarantee profits! Your deposit is approved. Amelia will approve it today.";
      const result = checkDraft(draft, ctx());
      expect(result.length).toBeLessThanOrEqual(6);
      expect(new Set(result).size).toBe(result.length);
    });
  });

  // M3: URLs compare case-insensitively on scheme+host, and http/https are equivalent.
  describe("case- and scheme-insensitive URL comparison", () => {
    it("allows an upper-cased scheme and host", () => {
      expect(checkDraft("HTTPS://APP.MARKETMAKERSFX.NET/upgrade", ctx())).toEqual([]);
    });
    it("treats http:// the same as https://", () => {
      expect(checkDraft("http://app.marketmakersfx.net/upgrade", ctx())).toEqual([]);
    });
  });

  // M4: an email address must never be mistaken for a handle, even one with
  // a non-Latin (non-\w) character directly before the "@".
  it("does not treat a non-Latin-prefixed email as a handle", () => {
    expect(checkDraft("Hubungi 支援@example.com", ctx())).toEqual([]);
  });

  // M5: the amounts exemption is scoped to currency-adjacent numbers, not
  // any number the member happened to type (kept passing after the rewrite).
  it("still allows an amount the member wrote themselves", () => {
    expect(checkDraft("Your $198 counts toward Foundation.", ctx(["I have $198 in my account"]))).toEqual([]);
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

  // I5: Malay and Chinese stems, plus the missing English phrasings.
  it("hands off Malay and Chinese phrasing in the same categories", () => {
    expect(mustHandOff("saya sudah bayar semalam", "other")).toMatch(/payment/);
    expect(mustHandOff("duit saya hilang", "other")).toMatch(/funds/);
    expect(mustHandOff("我要提款", "other")).toMatch(/withdraw/);
  });
  it("hands off the missing English phrasings", () => {
    expect(mustHandOff("I made the payment yesterday", "other")).toMatch(/payment/);
    expect(mustHandOff("my transfer is done", "other")).toMatch(/payment/);
    expect(mustHandOff("close my account", "other")).toMatch(/deletion/);
  });
});
