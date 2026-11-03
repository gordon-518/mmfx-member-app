import { describe, it, expect, vi } from "vitest";
import { buildChatSystem, buildChatUserContent, decideChat, CHAT_MODEL, THREAD_WINDOW } from "./agent";
import { buildAppGuide } from "./guide";
import { buildFactSheet } from "@/lib/support/facts";
import type { SupportSettings } from "@/lib/support/types";
import type { ChatMember, ChatMessage } from "./types";

const settings: SupportSettings = {
  enabled: true, bonus_code: "TeamMM001", bonus_code_expires: "2026-12-15",
  official_accounts: [{ handle: "MM_3000", label: "Admin Amelia" }],
  office_hours: "x", trade_cadence: "y", notes: "", approved_flows: [],
};
const facts = buildFactSheet(settings, new Date("2026-11-04T04:00:00Z"));
const guide = buildAppGuide();
const member: ChatMember = {
  userId: "u1", email: "m@example.com", tier: "foundation", trialEndsAt: "2026-11-10", depositTotal: 50,
  submission: { status: "pending", amount: 150 }, locale: "ms",
};
const msg = (id: number, role: ChatMessage["role"], body: string): ChatMessage => ({ id, role, body, created_at: "2026-11-04T00:00:00Z" });

describe("prompt", () => {
  it("puts the rules, the facts and the app guide in the system prompt", () => {
    const sys = buildChatSystem(facts, guide);
    expect(sys).toMatch(/never give trading advice/);
    expect(sys).toContain("FACTS\n");
    expect(sys).toContain("APP GUIDE\n");
    expect(sys).toContain(facts.text);
  });

  it("tells the model who is signed in, in which app language", () => {
    const user = buildChatUserContent({ thread: [msg(1, "member", "Apa tier saya?")], member });
    expect(user).toMatch(/identity confirmed/);
    expect(user).toMatch(/tier: Foundation/);
    expect(user).toMatch(/latest deposit submission: pending \(\$150\)/);
    expect(user).toMatch(/app language: Bahasa Melayu/);
  });

  it("labels who said what, drops system events and redacts contact details", () => {
    const user = buildChatUserContent({
      thread: [msg(1, "member", "my email is a@b.com"), msg(2, "system", "handoff"), msg(3, "staff", "Hi, checking now"), msg(4, "assistant", "ok")],
      member,
    });
    expect(user).toContain("[member] my email is [email]");
    expect(user).toContain("[team] Hi, checking now");
    expect(user).toContain("[assistant] ok");
    expect(user).not.toContain("handoff");
  });

  it("keeps only the latest messages", () => {
    const thread = Array.from({ length: THREAD_WINDOW + 5 }, (_, i) => msg(i, "member", `m${i}`));
    const user = buildChatUserContent({ thread, member });
    expect(user).not.toContain("[member] m0\n");
    expect(user).toContain(`[member] m${THREAD_WINDOW + 4}`);
  });

  it("feeds the guard's reasons back on a redraft", () => {
    const user = buildChatUserContent({ thread: [msg(1, "member", "hi")], member, retryReasons: ["amount not on the fact sheet: $999"] });
    expect(user).toMatch(/previous draft was rejected: amount not on the fact sheet: \$999/);
  });
});

describe("decideChat", () => {
  const ok = (decision: unknown) => ({ stop_reason: "end_turn", model: CHAT_MODEL, content: [{ type: "text", text: JSON.stringify(decision) }] });
  const fake = (response: unknown) => {
    const create = vi.fn<(req: Record<string, unknown>) => Promise<unknown>>(async () => response);
    return { c: { beta: { messages: { create } } } as never, create };
  };

  it("sends the configured model with fallbacks, explicit effort and a cached system prompt", async () => {
    const { c, create } = fake(ok({ action: "reply", topic: "plans", confidence: 0.9, reply: "Hi", reason: "r" }));
    const res = await decideChat({ facts, guide, thread: [msg(1, "member", "hi")], member }, c);
    expect(res.decision?.reply).toBe("Hi");
    const req = create.mock.calls[0][0] as { model: string; fallbacks: string; betas: string[]; output_config: { effort: string }; system: { cache_control?: unknown }[] };
    expect(req.model).toBe(CHAT_MODEL);
    expect(req.fallbacks).toBe("default");
    expect(req.betas).toContain("server-side-fallback-2026-07-01");
    expect(req.output_config.effort).toBe("medium");
    expect(req.system[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("reports a refusal, a truncation and a thrown error without throwing", async () => {
    expect((await decideChat({ facts, guide, thread: [], member }, fake({ stop_reason: "refusal", model: "m", content: [] }).c)).refused).toBe(true);
    expect((await decideChat({ facts, guide, thread: [], member }, fake({ stop_reason: "max_tokens", model: "m", content: [] }).c)).error).toMatch(/truncated/);
    const boom = { beta: { messages: { create: async () => { throw new Error("network down"); } } } } as never;
    expect((await decideChat({ facts, guide, thread: [], member }, boom)).error).toBe("network down");
  });

  it("rejects a reply decision with a blank reply", async () => {
    const { c } = fake(ok({ action: "reply", topic: "plans", confidence: 0.9, reply: "  ", reason: "r" }));
    expect((await decideChat({ facts, guide, thread: [], member }, c)).decision).toBeNull();
  });
});
