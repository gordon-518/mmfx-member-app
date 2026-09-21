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
      submission: { status: "verified", rejectReason: null, createdAt: "2026-09-14" }, attested: true };
    expect(checkDraft("Your deposit is approved.", ctx([], verified))).toEqual([]);
  });

  // A verified submission alone must not unlock the claim: a reference code
  // can be forwarded or pasted from someone else's screenshot, so an
  // unattested match (ref code only, no platform-confirmed Telegram account)
  // must still be blocked from confirming a deposit.
  it("still blocks a deposit-approved claim when the submission is verified but the match is unattested", () => {
    const verifiedUnattested: MemberContext = { userId: "u", matchedBy: "ref", tier: "foundation", trialEndsAt: null,
      submission: { status: "verified", rejectReason: null, createdAt: "2026-09-14" }, attested: false };
    expect(checkDraft("Your deposit is approved.", ctx([], verifiedUnattested))).toEqual([expect.stringContaining("deposit")]);
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
        submission: { status: "verified", rejectReason: null, createdAt: "2026-09-14" }, attested: true,
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

  // R1: IB merge blind spot (regression) — two adjacent numbers must never
  // merge into one over-long token and get silently dropped.
  describe("IB merge blind spot", () => {
    it("blocks a competing IB even when a correct one sits right next to it", () => {
      expect(checkDraft("Our IB is 47807426, 5928887 is not ours.", ctx())).toEqual([expect.stringContaining("5928887")]);
    });
    it("blocks two adjacent account numbers, not just one merged token", () => {
      const result = checkDraft("Accounts 1234567, 2345678 are both linked.", ctx());
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("1234567");
      expect(result[0]).toContain("2345678");
    });
    it("does not falsely block a member's own account when a second number sits next to it in their message", () => {
      expect(
        checkDraft("Your account 1234567 is linked.", ctx(["my accounts are 1234567, 2345678"]))
      ).toEqual([]);
    });
    it("stays clean on ordinary amounts, dates and phone numbers", () => {
      expect(checkDraft("$1,588", ctx())).toEqual([]);
      expect(checkDraft("2026-12-15", ctx())).toEqual([]);
      expect(checkDraft("USD 1,588.00", ctx())).toEqual([]);
      expect(checkDraft("Call us on +60 12 345 6789", ctx())).toEqual([]);
      expect(checkDraft("WhatsApp 60123456789", ctx(["WhatsApp 60123456789"]))).toEqual([]);
    });
  });

  // R2: handle regression — a non-whitespace character before "@" must not
  // disable the handle check.
  describe("handle regression: non-whitespace before @", () => {
    it.each([
      "Message (@scammer) now.",
      'Message "@scammer" now.',
      "Ask Amelia,@scammer for help.",
    ])("blocks %s", (text) => {
      expect(checkDraft(text, ctx())).toEqual([expect.stringContaining("@scammer")]);
    });
    it.each([
      "Hubungi 支援@example.com",
      "support@marketmakersfx.net",
      "name.surname@example.com",
      "Message @MM_3000",
      "Amelia (@MM_3000) can help",
    ])("still passes %s", (text) => {
      expect(checkDraft(text, ctx())).toEqual([]);
    });
  });

  // R3: CODE_RE must not read a capitalised ordinary word as a code.
  describe("CODE_RE: ordinary capitalised words are not codes", () => {
    it.each(["Use the code Amelia sent you.", "Paste the code Telegram sent you."])("passes %s", (text) => {
      expect(checkDraft(text, ctx())).toEqual([]);
    });
    it.each(["SUMMER2026", "XYZ99", "WELCOME"])("still blocks a code shape %s", (code) => {
      expect(checkDraft(`Use code ${code}.`, ctx())).toEqual([expect.stringContaining("bonus")]);
    });
    it("still allows the current bonus code", () => {
      expect(checkDraft("Use code TeamMM001.", ctx())).toEqual([]);
    });
    it("still allows a reference code", () => {
      expect(checkDraft("Your reference code MM-3F9A2C is noted.", ctx())).toEqual([]);
    });
  });

  // R4: PROFIT_RE false blocks — soft words need money/rate context.
  describe("PROFIT_RE: soft words need money or rate context", () => {
    it.each([
      "You can earn your Foundation tier with a $50 top-up.",
      "Your gains and losses stay in your own account.",
      "We can't promise any income.",
      "Once you have earned Foundation you keep it.",
    ])("passes %s", (text) => {
      expect(checkDraft(text, ctx())).toEqual([]);
    });
    it.each([
      "You'll earn more.",
      "extra income monthly",
      "10% a month is realistic",
      "win every trade",
      "gains of 5%",
      "ROI is strong",
      "passive income",
      "Profits are guaranteed",
      "Let's start printing together!",
    ])("still blocks %s", (text) => {
      expect(checkDraft(text, ctx())).toEqual([expect.stringContaining("profit")]);
    });
  });

  // R5: the "soon" veto is scoped to "as soon as", and the veto window is
  // clause-scoped so an earlier clause's veto word doesn't leak in.
  describe("claim veto: 'soon' scoping and clause boundaries", () => {
    it.each([
      "Access opens soon, and your deposit is approved.",
      "You'll hear from us soon — your deposit is approved.",
      "soon your deposit is approved",
      "Once more, your deposit is approved.",
      "I will check: your deposit is approved.",
    ])("blocks %s", (text) => {
      expect(checkDraft(text, ctx())).toEqual([expect.stringContaining("deposit")]);
    });
    it("passes the fact sheet's own 'as soon as' phrasing", () => {
      expect(checkDraft("Team MM opens as soon as the deposit is approved.", ctx())).toEqual([]);
    });
    it("still allows the other negated/conditional approval phrasings", () => {
      expect(checkDraft("Your top-up hasn't been approved yet.", ctx())).toEqual([]);
      expect(checkDraft("Your deposit is not approved yet.", ctx())).toEqual([]);
      expect(checkDraft("Your submission is pending, not verified yet.", ctx())).toEqual([]);
      expect(
        checkDraft("The team will check your submission and email you once it's approved.", ctx())
      ).toEqual([]);
    });
    it("still blocks a bare approved claim, and passes it once verified and attested", () => {
      expect(checkDraft("Your deposit is approved.", ctx())).toEqual([expect.stringContaining("deposit")]);
      const verified: MemberContext = {
        userId: "u", matchedBy: "ref", tier: "foundation", trialEndsAt: null,
        submission: { status: "verified", rejectReason: null, createdAt: "2026-09-14" }, attested: true,
      };
      expect(checkDraft("Your deposit is approved.", ctx([], verified))).toEqual([]);
    });
    it("still blocks a promise that someone else will approve it", () => {
      expect(checkDraft("Amelia will approve your deposit today.", ctx())).toEqual([expect.stringContaining("promise")]);
    });
  });

  // R6: the member-digit exemption must not whitewash the competing IB when
  // the draft itself presents the number as an IB/partner code.
  describe("member-digit exemption does not cover an IB-presented number", () => {
    it("blocks a competing IB even when the member pasted the same number as their IB", () => {
      expect(
        checkDraft("Your IB is 5928887 as you said.", ctx(["my ib is 5928887"]))
      ).toEqual([expect.stringContaining("5928887")]);
    });
    it("still allows a member's own account number when not framed as an IB", () => {
      expect(checkDraft("Your trading account 2167136 is linked.", ctx(["my account 2167136"]))).toEqual([]);
    });
  });

  // R7: dot/dash separated IB numbers, masking dates and decimals first.
  describe("dot/dash separated IB numbers", () => {
    it.each(["IB 592-8887", "Use 5.928.887 as IB."])("blocks %s", (text) => {
      expect(checkDraft(text, ctx())).toEqual([expect.stringContaining("IB")]);
    });
    it.each(["2026-12-15", "$1,588", "USD 1,588.00"])("stays clean on %s", (text) => {
      expect(checkDraft(text, ctx())).toEqual([]);
    });
  });

  // R8: path-less bad domains — a bare host with no trailing path must
  // still be caught.
  describe("bare-host link scan", () => {
    it.each(["Go to evil-signals.com now.", "www.evil.com"])("blocks %s", (text) => {
      expect(checkDraft(text, ctx())).toEqual([expect.stringContaining("link")]);
    });
    it.each(["Node.js is used behind the scenes.", "Confirm your amount, e.g. $50."])(
      "does not false-positive on %s",
      (text) => {
        expect(checkDraft(text, ctx()).filter((r) => r.startsWith("link"))).toEqual([]);
      }
    );
  });

  // R9: further profit phrasing the old regex missed.
  describe("further profit phrasing", () => {
    it.each([
      "you will make 5% weekly",
      "Your account can double in a month.",
      "Members often 10x their account.",
    ])("blocks %s", (text) => {
      expect(checkDraft(text, ctx())).toEqual([expect.stringContaining("profit")]);
    });
  });

  // R10: a new rule for the fact sheet's own "never tell anyone their money
  // is safe or protected" instruction — nothing currently enforces it.
  describe("money/funds 'safe' claim", () => {
    it("blocks a money-is-safe claim", () => {
      const result = checkDraft("Your money is safe with us.", ctx());
      expect(result).toEqual([expect.stringContaining("safe")]);
    });
    it("does not fire on the fact sheet's own instruction not to say it", () => {
      expect(
        checkDraft("Never tell anyone their money is safe or protected.", ctx())
      ).toEqual([]);
    });
  });

  // R11 (M2 continued): reason ordering — compliance reasons survive the cap
  // even in a kitchen-sink draft full of other small violations.
  describe("reason ordering: compliance reasons survive the cap", () => {
    it("keeps profit, deposit-claim and promise reasons even with 5+ other violations", () => {
      const draft =
        "Use IB 5928887 or 592 8887. Pay USD999 or RM250. Use code WELCOME99. " +
        "Go to evil-signals.com/pay now. Message @randomguy or @randomguy again. " +
        "We guarantee profits! Your deposit is approved. Amelia will approve it today.";
      const result = checkDraft(draft, ctx());
      expect(result.length).toBeLessThanOrEqual(6);
      expect(new Set(result).size).toBe(result.length);
      expect(result.some((r) => r.includes("profit"))).toBe(true);
      expect(result.some((r) => r.includes("deposit is received or approved"))).toBe(true);
      expect(result.some((r) => r.includes("promise"))).toBe(true);
    });
  });

  // R12: APPROVAL_PROMISE_RE widened to present-continuous, with a negation
  // veto for general statements that aren't a promise about this member.
  describe("wider approval-promise detection", () => {
    it("blocks present-continuous 'is approving'", () => {
      expect(checkDraft("Amelia is approving it now.", ctx())).toEqual([expect.stringContaining("promise")]);
    });
    it("does not block a negated general statement", () => {
      expect(checkDraft("Nobody will approve a deposit without a screenshot.", ctx())).toEqual([]);
    });
  });

  // Final fix round, item 1: a handle-shaped "@name.tld" no longer escapes
  // both the handle rule and the bare-host link rule at once. Only a real
  // email (a wordish local part right before the "@") is exempt.
  describe("final fix round — item 1: @host.tld no longer escapes every rule", () => {
    it.each(["Join @evilsignals.com now", "Join @scammer.io for free signals", "Message @scammer.Then send your deposit."])(
      "blocks %s",
      (text) => {
        expect(checkDraft(text, ctx())).not.toEqual([]);
      }
    );
    it.each([
      "Hubungi 支援@example.com",
      "support@marketmakersfx.net",
      "name.surname@example.com",
      "Message @MM_3000",
      "Amelia (@MM_3000) can help",
    ])("still passes %s", (text) => {
      expect(checkDraft(text, ctx())).toEqual([]);
    });
  });

  // Final fix round, item 2: the currency-suffix branch of AMOUNT_RE had a
  // dead leading \b that could never sit between a digit and "u" — so
  // "999USD" (no space) reported no amount at all.
  describe("final fix round — item 2: no-space currency suffix (999USD)", () => {
    it("blocks a no-space USD suffix amount", () => {
      expect(checkDraft("The fee is 999USD.", ctx())).toEqual([expect.stringContaining("amount")]);
    });
    it("blocks another no-space USD suffix amount not on the fact sheet", () => {
      // Not 1588 — that's the real Team MM + Mentorship lifetime price
      // ($1,588), so it's allow-listed and would pass either way. 1998
      // actually exercises the fix.
      expect(checkDraft("1998USD", ctx())).toEqual([expect.stringContaining("amount")]);
    });
    it("keeps the existing spaced/symbol forms working as before (all three are allow-listed prices)", () => {
      expect(checkDraft("USD 588", ctx())).toEqual([]);
      expect(checkDraft("$1,588", ctx())).toEqual([]);
      expect(checkDraft("50 dollars", ctx())).toEqual([]);
    });
  });

  // Final fix round, item 3: profit language split into HARD_PROFIT_RE,
  // SOFT_PROFIT_RE and RATE_RE, with the gaps the reviewer found now closed.
  describe("final fix round — item 3: split profit rules close the gaps", () => {
    it.each([
      "Most members double their account.",
      "grow your account",
      "consistent wins",
      "500 pips a month",
      "Our win rate is 90%.",
      "recover your losses",
      "untung besar",
      "keuntungan dijamin",
      "pasti untung",
      "保证每月盈利",
      "稳赚",
      "赚钱",
    ])("blocks %s", (text) => {
      expect(checkDraft(text, ctx())).toEqual([expect.stringContaining("profit")]);
    });
    it.each([
      "You can earn your Foundation tier with a $50 top-up.",
      "Your gains and losses stay in your own account.",
      "We can't promise any income.",
      "Once you have earned Foundation you keep it.",
    ])("still passes %s", (text) => {
      expect(checkDraft(text, ctx())).toEqual([]);
    });
    it("still passes the whole fact sheet", () => {
      expect(checkDraft(facts.text, ctx()).filter((r) => !r.startsWith("too long"))).toEqual([]);
    });
  });

  // Final fix round, item 4: DEPOSIT_WORD_RE missed "payment"/"transfer"/
  // "funds" — a claim using those words instead of "deposit" slipped past.
  describe("final fix round — item 4: wider deposit-claim vocabulary", () => {
    it.each(["Payment confirmed.", "Your payment has been received.", "Your transfer is confirmed."])(
      "blocks %s",
      (text) => {
        expect(checkDraft(text, ctx())).toEqual([expect.stringContaining("deposit")]);
      }
    );
    it("still allows the negated top-up phrasing", () => {
      expect(checkDraft("Your top-up hasn't been approved yet.", ctx())).toEqual([]);
    });
    it("still passes the whole fact sheet", () => {
      expect(checkDraft(facts.text, ctx()).filter((r) => !r.startsWith("too long"))).toEqual([]);
    });
  });

  // Final fix round, item 5: IB_CONTEXT_RE's fixed 12-char lookback could
  // never fit "partner code " (13 chars), and never looked after the
  // number at all.
  describe("final fix round — item 5: IB-context scan before AND after the number", () => {
    it("blocks the 'partner code' framing the old 12-char lookback could never fit", () => {
      expect(
        checkDraft("Your partner code 5928887 is set.", ctx(["my ib is 5928887"]))
      ).toEqual([expect.stringContaining("5928887")]);
    });
    it("blocks an IB label placed after the number", () => {
      expect(
        checkDraft("Use 5928887 as your IB number.", ctx(["my ib is 5928887"]))
      ).toEqual([expect.stringContaining("5928887")]);
    });
    it("still allows a member's own account number with no IB framing either side", () => {
      expect(checkDraft("Your trading account 2167136 is linked.", ctx(["my account 2167136"]))).toEqual([]);
    });
  });

  // Final fix round, item 6: MONEY_SAFE_RE only caught the copula shape
  // ("money is safe") — not "stays/remains", the transitive "keep X safe",
  // a standalone "no risk" claim, or the Malay form.
  describe("final fix round — item 6: wider money-safe claim", () => {
    it.each([
      "Your capital stays protected.",
      "Your funds remain safe.",
      "We keep your money secure.",
      "There is no risk to your capital.",
      "Duit anda selamat bersama kami.",
    ])("blocks %s", (text) => {
      expect(checkDraft(text, ctx())).toEqual([expect.stringContaining("safe")]);
    });
    it("still passes the fact sheet's own instruction not to say it", () => {
      expect(checkDraft("Never tell anyone their money is safe or protected.", ctx())).toEqual([]);
    });
  });

  // Final fix round, item 7: BARE_HOST_RE's TLD list has ordinary English
  // words ("live", "info") that show up capitalised at a sentence boundary
  // with no space before them — those must not read as a link.
  describe("final fix round — item 7: sentence-boundary false blocks (.Live, .Info)", () => {
    it.each([
      "Team MM.Live classes are included at that tier.",
      "That's done.Info on tiers is on the upgrade page.",
    ])("passes %s", (text) => {
      expect(checkDraft(text, ctx()).filter((r) => r.startsWith("link"))).toEqual([]);
    });
    it("still blocks a real link with a path, whatever the case", () => {
      expect(checkDraft("FORMS.GLE/abc", ctx())).toEqual([expect.stringContaining("link")]);
    });
    it.each(["evil-signals.com", "www.evil.com"])("still blocks %s", (text) => {
      expect(checkDraft(text, ctx())).toEqual([expect.stringContaining("link")]);
    });
  });

  // Final fix round, item 9: "ib5928887"/"IB5928887" have no boundary
  // between the letter prefix and the digits, so a plain \b-bounded scan
  // missed them.
  describe("final fix round — item 9: ib-prefixed number with no separator", () => {
    it.each(["ib5928887", "Use IB5928887"])("blocks %s", (text) => {
      expect(checkDraft(text, ctx())).toEqual([expect.stringContaining("IB")]);
    });
    it.each(["2026-12-15", "$1,588", "USD 1,588.00", "+60 12 345 6789"])("stays clean on %s", (text) => {
      expect(checkDraft(text, ctx())).toEqual([]);
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

  // R13: Malay phrases scoped to a nearby money word, so routine non-money
  // questions using the same words aren't misrouted to a human.
  describe("Malay phrases scoped to a nearby money word", () => {
    it("does not hand off a routine access question", () => {
      expect(mustHandOff("kenapa akses saya belum masuk?", "access")).toBeNull();
    });
    it("does not hand off withdrawing a question", () => {
      expect(mustHandOff("saya nak tarik balik soalan tadi", "other")).toBeNull();
    });
    it("does not hand off a routine repayment-timing question", () => {
      expect(mustHandOff("boleh saya bayar balik bulan depan?", "other")).toBeNull();
    });
    it("leaves a normal join question alone", () => {
      expect(mustHandOff("macam mana nak bayar?", "join")).toBeNull();
    });
    it("still hands off when a money word is nearby", () => {
      expect(mustHandOff("deposit saya belum masuk", "other")).toMatch(/funds/);
      expect(mustHandOff("saya sudah bayar semalam", "other")).toMatch(/payment/);
      expect(mustHandOff("duit saya hilang", "other")).toMatch(/funds/);
      expect(mustHandOff("我要提款", "other")).toMatch(/withdraw/);
    });
  });

  // Final fix round, item 8: mustHandOff stem gaps — English "money back",
  // and Malay/Chinese phrasings for funds-not-arrived, money deducted,
  // already-transferred and paid-but-no-access.
  describe("final fix round — item 8: mustHandOff stem gaps", () => {
    it.each([
      "I want my money back",
      "我的钱还没到账",
      "我已经转账了",
      "钱被扣了",
      "我付了钱但没有权限",
      "duit saya tak masuk lagi",
      "saya dah transfer duit",
      "saya nak minta duit balik",
    ])("hands off %s", (text) => {
      expect(mustHandOff(text, "other")).toBeTruthy();
    });
    it.each([
      "kenapa akses saya belum masuk?",
      "macam mana nak bayar?",
      "saya nak tarik balik soalan tadi",
    ])("still leaves %s alone", (text) => {
      expect(mustHandOff(text, "other")).toBeNull();
    });
  });
});
