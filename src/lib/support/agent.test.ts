import { describe, it, expect, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { decide, buildSystem, buildUserContent, redactForModel, defaultClient, MODEL } from "./agent";
import { buildFactSheet } from "./facts";
import type { ContactInfo, MemberContext, SupportSettings, ThreadMessage } from "./types";

const settings: SupportSettings = {
  enabled: true, bonus_code: "TeamMM001", bonus_code_expires: "2026-12-15",
  official_accounts: [{ handle: "MM_3000", label: "Admin Amelia" }],
  office_hours: "x", trade_cadence: "y", notes: "", approved_flows: [],
};
const facts = buildFactSheet(settings, new Date("2026-09-15T04:00:00Z"));

const contact: ContactInfo = { id: "1", username: "alex", firstName: "Alex", isBusiness: false, tags: [] };

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

  it("states tier and submission status when a member is matched", () => {
    const member: MemberContext = {
      userId: "u1", matchedBy: "handle", tier: "desk", trialEndsAt: null,
      submission: { status: "pending", rejectReason: null, createdAt: "2026-09-01T00:00:00Z" },
    };
    const content = buildUserContent({ thread: thread({ text: "hi" }), contact, member });
    expect(content).toContain("tier: Desk");
    expect(content).toContain("latest deposit submission: pending");
  });

  it("never leaks an admin's rejection note to the model, only the status", () => {
    const member: MemberContext = {
      userId: "u1", matchedBy: "ref", tier: "free", trialEndsAt: null,
      submission: { status: "rejected", rejectReason: "fake screenshot, suspected fraud", createdAt: "2026-09-01T00:00:00Z" },
    };
    const content = buildUserContent({ thread: thread({ text: "hi" }), contact, member });
    expect(content).toContain("latest deposit submission: rejected");
    expect(content).not.toContain("fake screenshot");
    expect(content).not.toContain("suspected fraud");
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

  it("does not corrupt text when a literal DATE0-like placeholder appears (no dates actually masked)", () => {
    const input = "my code is DATE0 later";
    const result = redactForModel(input);
    expect(result).toBe(input);
    expect(result).not.toContain("undefined");
  });

  it("preserves multiple dates in one message", () => {
    const input = "from 2026-09-15 to 2026-10-01";
    expect(redactForModel(input)).toBe(input);
  });

  it("keeps the original text intact when placeholder index has no corresponding date", () => {
    // This tests the robustness of the ?? fallback
    const result = redactForModel("weird text");
    expect(result).toContain("weird");
    expect(result).toContain("text");
    expect(result).not.toContain("undefined");
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
