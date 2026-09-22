import { describe, it, expect, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { decide, buildSystem, buildUserContent, describeTags, redactForModel, defaultClient, MODEL } from "./agent";
import { buildFactSheet } from "./facts";
import { tierLabel } from "@/lib/tiers";
import type { ContactInfo, MemberContext, SupportSettings, ThreadMessage } from "./types";

const settings: SupportSettings = {
  enabled: true, bonus_code: "TeamMM001", bonus_code_expires: "2026-12-15",
  official_accounts: [{ handle: "MM_3000", label: "Admin Amelia" }],
  office_hours: "x", trade_cadence: "y", notes: "", approved_flows: [],
};
const facts = buildFactSheet(settings, new Date("2026-09-15T04:00:00Z"));

const contact: ContactInfo = { id: "1", username: "alex", firstName: "Alex", isBusiness: false, tags: [], chatType: 1 };

function thread(...msgs: Partial<ThreadMessage>[]): ThreadMessage[] {
  return msgs.map((m, i) => ({
    id: String(i), direction: "in", fromFlow: false, text: "", at: "2026-09-15T00:00:00Z", ...m,
  }));
}

// The shape of the request `decide()` sends, narrowed to just the fields the
// tests assert on (real request bodies carry far more).
interface CapturedRequest {
  model: string;
  fallbacks: string;
  betas: string[];
  output_config: { effort: string };
  system: { text: string }[];
  messages: { content: string }[];
}

// The plan's fake client: a stand-in for the small slice of the SDK
// `decide()` actually calls, typed as `never` at the boundary rather than `any`.
function client(response: unknown) {
  const create = vi.fn<(req: CapturedRequest) => Promise<unknown>>(async () => response);
  return { c: { beta: { messages: { create } } } as never, create };
}

const ok = (decision: unknown) => ({
  stop_reason: "end_turn", model: "claude-opus-5",
  content: [{ type: "text", text: JSON.stringify(decision) }],
});

const validDecision = {
  action: "reply", topic: "plans", confidence: 0.9,
  reply: "Foundation starts at $50 - see https://app.marketmakersfx.net/upgrade",
  reason: "asked about tiers",
};

describe("decide", () => {
  it("returns a valid decision and sends the expected request shape", async () => {
    const { c, create } = client(ok(validDecision));
    const res = await decide({ facts, thread: thread({ text: "what are the plans?" }), contact, member: null }, c);
    expect(res.decision).toEqual(validDecision);
    expect(res.refused).toBe(false);

    expect(create).toHaveBeenCalledTimes(1);
    const req = create.mock.calls[0][0];
    expect(req.model).toBe("claude-opus-5");
    expect(req.fallbacks).toBe("default");
    expect(req.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(req.output_config.effort).toBe("medium");
    expect(req.system[0].text).toContain(facts.text);
  });

  it("returns refused on stop_reason 'refusal'", async () => {
    const { c } = client({ stop_reason: "refusal", model: "claude-opus-5", content: [] });
    const res = await decide({ facts, thread: thread({ text: "hi" }), contact, member: null }, c);
    expect(res.decision).toBeNull();
    expect(res.refused).toBe(true);
  });

  it("returns decision null when the output doesn't match the schema", async () => {
    const { c } = client(ok({ action: "reply", topic: "not-a-real-topic", confidence: 2, reply: 5 }));
    const res = await decide({ facts, thread: thread({ text: "hi" }), contact, member: null }, c);
    expect(res.decision).toBeNull();
    expect(res.refused).toBe(false);
    expect(res.error).toBe("output did not match the decision schema");
  });

  it("returns decision null for a reply decision with an empty reply", async () => {
    const { c } = client(ok({ action: "reply", topic: "plans", confidence: 0.9, reply: "", reason: "x" }));
    const res = await decide({ facts, thread: thread({ text: "hi" }), contact, member: null }, c);
    expect(res.decision).toBeNull();
    expect(res.error).toBe("output did not match the decision schema");
  });

  it("returns decision null for a reply decision with a whitespace-only reply", async () => {
    const { c } = client(ok({ action: "reply", topic: "plans", confidence: 0.9, reply: "   ", reason: "x" }));
    const res = await decide({ facts, thread: thread({ text: "hi" }), contact, member: null }, c);
    expect(res.decision).toBeNull();
    expect(res.error).toBe("output did not match the decision schema");
  });

  it("still parses a handoff decision with an empty reply", async () => {
    const handoff = { action: "handoff", topic: "money", confidence: 0.4, reply: "", reason: "needs human" };
    const { c } = client(ok(handoff));
    const res = await decide({ facts, thread: thread({ text: "hi" }), contact, member: null }, c);
    expect(res.decision).toEqual(handoff);
  });

  it("returns a truncation error when stop_reason is 'max_tokens'", async () => {
    const { c } = client({ stop_reason: "max_tokens", model: "claude-opus-5", content: [{ type: "text", text: "" }] });
    const res = await decide({ facts, thread: thread({ text: "hi" }), contact, member: null }, c);
    expect(res.decision).toBeNull();
    expect(res.refused).toBe(false);
    expect(res.error).toBe("model output was truncated");
  });

  it("returns decision null with an error message when the API call throws", async () => {
    const create = vi.fn(async () => { throw new Error("boom"); });
    const c = { beta: { messages: { create } } } as never;
    const res = await decide({ facts, thread: thread({ text: "hi" }), contact, member: null }, c);
    expect(res.decision).toBeNull();
    expect(res.error).toBe("boom");
  });

  it("also handles a thrown non-Error value without throwing itself", async () => {
    const create = vi.fn(async () => { throw "not an error object"; });
    const c = { beta: { messages: { create } } } as never;
    const res = await decide({ facts, thread: thread({ text: "hi" }), contact, member: null }, c);
    expect(res.decision).toBeNull();
    expect(res.error).toBe("not an error object");
  });

  it("also handles an empty/malformed JSON body without throwing", async () => {
    const { c } = client({ stop_reason: "end_turn", model: "claude-opus-5", content: [{ type: "text", text: "" }] });
    const res = await decide({ facts, thread: thread({ text: "hi" }), contact, member: null }, c);
    expect(res.decision).toBeNull();
    expect(res.refused).toBe(false);
  });

  it("passes redraft reasons back to the model", async () => {
    const { c, create } = client(ok(validDecision));
    await decide(
      { facts, thread: thread({ text: "what are the plans?" }), contact, member: null, retryReasons: ["too long (999 > 900)"] },
      c
    );
    const req = create.mock.calls[0][0];
    expect(req.messages[0].content).toContain("Your previous draft was rejected: too long (999 > 900)");
  });
});

describe("buildUserContent", () => {
  it("labels flow messages [bot flow], member messages [member] and MMFX messages [MMFX]", () => {
    const content = buildUserContent({
      thread: thread(
        { direction: "in", fromFlow: false, text: "hello" },
        { direction: "out", fromFlow: true, text: "welcome to MMFX" },
        { direction: "out", fromFlow: false, text: "here's the answer" }
      ),
      contact, member: null,
    });
    expect(content).toContain("[member] hello");
    expect(content).toContain("[bot flow] welcome to MMFX");
    expect(content).toContain("[MMFX] here's the answer");
  });

  it("says MEMBER: not identified when no member is matched", () => {
    const content = buildUserContent({ thread: thread({ text: "hi" }), contact, member: null });
    expect(content).toContain("MEMBER: not identified");
  });

  it("states tier and submission status when an attested member is matched", () => {
    const member: MemberContext = {
      userId: "u1", matchedBy: "handle", tier: "desk", trialEndsAt: null,
      submission: { status: "pending", rejectReason: null, createdAt: "2026-09-01T00:00:00Z" },
      attested: true,
    };
    const content = buildUserContent({ thread: thread({ text: "hi" }), contact, member });
    expect(content).toContain("tier: Desk");
    expect(content).toContain("latest deposit submission: pending");
  });

  it("never leaks an admin's rejection note to the model, only the status", () => {
    const member: MemberContext = {
      userId: "u1", matchedBy: "ref", tier: "free", trialEndsAt: null,
      submission: { status: "rejected", rejectReason: "fake screenshot, suspected fraud", createdAt: "2026-09-01T00:00:00Z" },
      attested: true,
    };
    const content = buildUserContent({ thread: thread({ text: "hi" }), contact, member });
    expect(content).toContain("latest deposit submission: rejected");
    expect(content).not.toContain("fake screenshot");
    expect(content).not.toContain("suspected fraud");
  });

  it("never states tier, trial or deposit status for an unattested reference-code-only match", () => {
    // Uses a "pending" submission (rather than an arbitrary status) so the
    // not.toContain("pending") assertion below is actually meaningful: it
    // fails if this line ever starts leaking the real status.
    const member: MemberContext = {
      userId: "u1", matchedBy: "ref", tier: "desk", trialEndsAt: "2026-10-01",
      submission: { status: "pending", rejectReason: null, createdAt: "2026-09-01T00:00:00Z" },
      attested: false,
    };
    const content = buildUserContent({ thread: thread({ text: "hi" }), contact, member });
    expect(content).not.toContain(tierLabel(member.tier));
    expect(content).not.toContain("pending");
    expect(content).not.toContain("2026-10-01");
    expect(content).not.toContain("matches an account");
    expect(content).toContain("upgrade");
  });
});

describe("redactForModel", () => {
  it("keeps an ISO date intact", () => {
    expect(redactForModel("my trial ends 2026-09-15")).toBe("my trial ends 2026-09-15");
  });

  it("still redacts a phone number", () => {
    expect(redactForModel("call me at +65 9123 4567")).toBe("call me at [number]");
  });

  it("still redacts an account-style number", () => {
    expect(redactForModel("my account 2167136")).toBe("my account [number]");
  });

  it("keeps a reference code intact", () => {
    expect(redactForModel("my code is MM-3F9A2C")).toBe("my code is MM-3F9A2C");
  });

  it("keeps an all-digit reference code intact (about 6% of codes are all-digit)", () => {
    expect(redactForModel("my code is MM-123456")).toBe("my code is MM-123456");
  });

  it("keeps the reference code and redacts a phone number and an account number in the same message", () => {
    const text = "my code is MM-123456, call +65 9123 4567, account 2167136";
    const redacted = redactForModel(text);
    expect(redacted).toContain("MM-123456");
    expect(redacted).not.toContain("9123 4567");
    expect(redacted).not.toContain("2167136");
  });

  it("keeps a small dollar amount intact", () => {
    expect(redactForModel("I paid $198")).toBe("I paid $198");
  });

  it("redacts an email address", () => {
    expect(redactForModel("reach me at alex@example.com")).toBe("reach me at [email]");
  });

  it("handles a date alongside a phone number and an account number in one message", () => {
    const text = "trial ends 2026-09-15, call +65 9123 4567, account 2167136";
    const redacted = redactForModel(text);
    expect(redacted).toContain("2026-09-15");
    expect(redacted).not.toContain("9123 4567");
    expect(redacted).not.toContain("2167136");
  });

  it("strips an embedded NUL byte so it can't collide with the sentinel and duplicate a date", () => {
    // Verified bug: before redactForModel stripped NUL bytes from the
    // input, a literal "\x00<digit>\x00"-shaped run in member text could be
    // mistaken for the masking sentinel and swapped for a saved date,
    // duplicating it. Stripping NUL up front makes that impossible.
    const input = "\x000\x00 and my trial ends 2026-09-15";
    expect(redactForModel(input)).toBe("0 and my trial ends 2026-09-15");
  });

  it("preserves multiple dates in one message", () => {
    const input = "from 2026-09-15 to 2026-10-01";
    expect(redactForModel(input)).toBe(input);
  });

  it("resolves multiple masked tokens (dates and a reference code) back to their originals by index", () => {
    const input = "trial ends 2026-09-15, renewal 2026-10-01, my code is MM-3F9A2C";
    expect(redactForModel(input)).toBe(input);
  });
});

describe("buildSystem", () => {
  it("contains both the rules and the facts", () => {
    const system = buildSystem(facts);
    expect(system).toContain("You are the MMFX Assistant");
    expect(system).toContain(facts.text);
  });

  it("tells the model to hand off a rejected submission rather than explain why", () => {
    expect(buildSystem(facts)).toMatch(/rejected.*hand off|hand off.*rejected/i);
  });
});

describe("defaultClient", () => {
  it("is constructed with maxRetries: 0 (no SDK-level retry, so a draft + one redraft fits the route's timeout budget)", () => {
    const c = defaultClient();
    expect(c).toBeInstanceOf(Anthropic);
    expect(c.maxRetries).toBe(0);
  });
});

describe("MODEL", () => {
  it("defaults to claude-opus-5", () => {
    expect(MODEL).toBe("claude-opus-5");
  });
});

describe("describeTags", () => {
  it("passes a single tag per group straight through", () => {
    expect(describeTags(["country_malaysia", "exp_mid", "intent_signals"]))
      .toBe("country_malaysia, exp_mid, intent_signals");
  });

  it("refuses to pick a country when the tags contradict each other", () => {
    // A real contact carried five: retaking the questionnaire adds, never replaces.
    const out = describeTags(["country_malaysia", "country_UK/USA", "country_singapore", "intent_learn"]);
    expect(out).not.toContain("country_malaysia");
    expect(out).not.toContain("country_UK/USA");
    expect(out).toContain("UNKNOWN");
    expect(out).toContain("intent_learn");
  });

  it("flags conflicting experience and capital bands too", () => {
    const out = describeTags(["exp_beginner", "exp_advanced", "capital_under100", "capital_1000plus"]);
    expect(out).toContain("experience");
    expect(out).toContain("capital");
    expect(out).toContain("UNKNOWN");
  });

  it("says none when there are no tags", () => {
    expect(describeTags([])).toBe("none");
  });

  it("is used by buildUserContent, so a conflicted contact never shows a country", () => {
    const content = buildUserContent({
      thread: [{ id: "1", direction: "in", fromFlow: false, text: "hi", at: "2026-09-15T01:00:00Z" }],
      contact: { id: "c1", username: null, firstName: "GG", isBusiness: false,
        tags: ["country_malaysia", "country_UK/USA"], chatType: 1 },
      member: null,
    });
    expect(content).toContain("UNKNOWN");
    expect(content).not.toContain("country_UK/USA");
  });
});
