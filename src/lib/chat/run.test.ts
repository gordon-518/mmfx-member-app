import { describe, it, expect, vi } from "vitest";
import { handleMemberMessage, chatFacts, MAX_MEMBER_MESSAGES_PER_HOUR, REPING_MINUTES, type ChatDeps, type HandoffNotice } from "./run";
import type { ChatStore, ChatThread, NewMessage } from "./store";
import type { ChatMember, ChatMessage } from "./types";
import type { ChatDecision } from "./agent";
import { buildFactSheet } from "@/lib/support/facts";
import type { SupportSettings } from "@/lib/support/types";

const settings: SupportSettings & { chat_enabled: boolean } = {
  enabled: true, chat_enabled: true, bonus_code: "TeamMM001", bonus_code_expires: "2026-12-15",
  official_accounts: [{ handle: "MM_3000", label: "Admin Amelia" }],
  office_hours: "during Singapore office hours", trade_cadence: "around 2–3 trades a day", notes: "", approved_flows: [],
};

const member: ChatMember = {
  userId: "u1", email: "m@example.com", tier: "desk", trialEndsAt: null, depositTotal: 230,
  submission: { status: "verified", amount: 30 }, locale: "zh-Hans",
};

const NOW = new Date("2026-11-04T04:00:00Z");

function memoryStore(init?: { thread?: ChatThread; memberMsgsLastHour?: number; callsToday?: number; enabled?: boolean }) {
  const messages: (ChatMessage & NewMessage)[] = [];
  let thread: ChatThread | null = init?.thread ?? null;
  const store: ChatStore = {
    getSettings: async () => ({ ...settings, chat_enabled: init?.enabled ?? true }),
    getThread: async () => thread,
    saveThread: async (patch) => {
      const base: ChatThread = { user_id: patch.user_id, state: "bot", locale: null, handoff_reason: null, last_ping_at: null, member_last_read_at: null };
      thread = { ...base, ...thread, ...patch };
    },
    addMessage: async (m) => {
      const row = { ...m, id: messages.length + 1, created_at: NOW.toISOString() } as ChatMessage & NewMessage;
      messages.push(row);
      return { id: row.id, role: row.role, body: row.body, created_at: row.created_at };
    },
    recent: async () => messages.map(({ id, role, body, created_at }) => ({ id, role, body, created_at })),
    countMemberMessagesSince: async () => init?.memberMsgsLastHour ?? 0,
    countAssistantCallsSince: async () => init?.callsToday ?? 0,
  };
  return { store, messages, thread: () => thread };
}

function deps(store: ChatStore, decisions: ChatDecision[]) {
  const decide = vi.fn(async () => decisions.shift() ?? { decision: null, refused: false, model: "m", error: "no more" });
  const notify = vi.fn<(n: HandoffNotice) => Promise<void>>(async () => {});
  const d: ChatDeps = { store, decide: decide as unknown as ChatDeps["decide"], notify, now: () => NOW };
  return { d, decide, notify };
}

const reply = (text: string, extra: Partial<NonNullable<ChatDecision["decision"]>> = {}): ChatDecision => ({
  decision: { action: "reply", topic: "plans", confidence: 0.9, reply: text, reason: "faq", ...extra },
  refused: false,
  model: "claude-opus-5-5",
});

describe("handleMemberMessage", () => {
  it("answers a covered question and stores both sides", async () => {
    const { store, messages } = memoryStore();
    const { d, notify } = deps(store, [reply("Foundation 从 **$50** 起。")]);
    const out = await handleMemberMessage(member, "等级怎么算？", d);
    expect(out.kind).toBe("reply");
    expect(messages.map((m) => m.role)).toEqual(["member", "assistant"]);
    expect(messages[1].model).toBe("claude-opus-5-5");
    expect(notify).not.toHaveBeenCalled();
  });

  it("hands off when the model says so, and pings once", async () => {
    const { store, messages, thread } = memoryStore();
    const { d, notify } = deps(store, [{ decision: { action: "handoff", topic: "other", confidence: 0.4, reply: "", reason: "not covered" }, refused: false, model: "m" }]);
    const out = await handleMemberMessage(member, "Can I get an invoice?", d);
    expect(out.kind).toBe("handoff");
    expect(messages.map((m) => [m.role, m.body])).toEqual([["member", "Can I get an invoice?"], ["system", "handoff"]]);
    expect(thread()?.state).toBe("needs_human");
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0].reason).toBe("not covered");
  });

  it("sends money questions straight to a person, without calling the model", async () => {
    const { store } = memoryStore();
    const { d, decide } = deps(store, []);
    const out = await handleMemberMessage(member, "I want a refund for my withdrawal", d);
    expect(out.kind).toBe("handoff");
    expect(decide).not.toHaveBeenCalled();
  });

  it("hands off on low confidence", async () => {
    const { store } = memoryStore();
    const { d } = deps(store, [reply("maybe", { confidence: 0.5 })]);
    expect((await handleMemberMessage(member, "hmm?", d)).kind).toBe("handoff");
  });

  it("redrafts once when the guard rejects the draft, then sends the fixed reply", async () => {
    const { store, messages } = memoryStore();
    const { d, decide } = deps(store, [reply("Desk is **$999**."), reply("Desk starts at **$200**.")]);
    const out = await handleMemberMessage(member, "How much is Desk?", d);
    expect(out.kind).toBe("reply");
    expect(decide).toHaveBeenCalledTimes(2);
    expect((decide.mock.calls[1] as unknown as [{ retryReasons: string[] }])[0].retryReasons.join(" ")).toMatch(/999/);
    expect(messages.at(-1)?.body).toBe("Desk starts at **$200**.");
  });

  it("hands off when the redraft fails the guard too", async () => {
    const { store } = memoryStore();
    const { d } = deps(store, [reply("Desk is **$999**."), reply("Desk is **$998**.")]);
    expect((await handleMemberMessage(member, "How much is Desk?", d)).kind).toBe("handoff");
  });

  it("lets the member's own deposit amounts through the guard", async () => {
    const { store } = memoryStore();
    const { d } = deps(store, [reply("Your verified deposits add up to **$230**, so you're on **Desk**.", { topic: "access" })]);
    expect((await handleMemberMessage(member, "what tier am I?", d)).kind).toBe("reply");
  });

  it("queues messages while a person has the thread, re-pinging only after a pause", async () => {
    const recent = new Date(NOW.getTime() - 5 * 60_000).toISOString();
    const { store } = memoryStore({ thread: { user_id: "u1", state: "needs_human", locale: "en", handoff_reason: "x", last_ping_at: recent, member_last_read_at: null } });
    const { d, decide, notify } = deps(store, []);
    expect((await handleMemberMessage(member, "hello?", d)).kind).toBe("queued");
    expect(decide).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();

    const old = new Date(NOW.getTime() - (REPING_MINUTES + 1) * 60_000).toISOString();
    const second = memoryStore({ thread: { user_id: "u1", state: "needs_human", locale: "en", handoff_reason: "x", last_ping_at: old, member_last_read_at: null } });
    const two = deps(second.store, []);
    await handleMemberMessage(member, "anyone?", two.d);
    expect(two.notify).toHaveBeenCalledTimes(1);
  });

  it("rate-limits a flood and refuses empty or oversized messages", async () => {
    const { store } = memoryStore({ memberMsgsLastHour: MAX_MEMBER_MESSAGES_PER_HOUR });
    const { d } = deps(store, []);
    expect((await handleMemberMessage(member, "hi", d)).kind).toBe("rate_limited");
    const fresh = deps(memoryStore().store, []);
    expect((await handleMemberMessage(member, "   ", fresh.d)).kind).toBe("invalid");
    expect((await handleMemberMessage(member, "x".repeat(1001), fresh.d)).kind).toBe("invalid");
  });

  it("goes straight to a person when the assistant is switched off", async () => {
    const { store } = memoryStore({ enabled: false });
    const { d, decide } = deps(store, []);
    expect((await handleMemberMessage(member, "hi", d)).kind).toBe("handoff");
    expect(decide).not.toHaveBeenCalled();
  });

  it("hands off when the model errors", async () => {
    const { store } = memoryStore();
    const { d } = deps(store, [{ decision: null, refused: false, model: "m", error: "timeout" }]);
    const out = await handleMemberMessage(member, "hi", d);
    expect(out.kind === "handoff" && out.reason).toMatch(/timeout/);
  });
});

describe("chatFacts", () => {
  it("allows every app page, the public channel and the member's own amounts", () => {
    const f = chatFacts(buildFactSheet(settings, NOW), member);
    expect(f.allow.appPaths).toContain("/journal");
    expect(f.allow.urls).toContain("https://t.me/mmfx_academy");
    expect(f.allow.amounts.has(230)).toBe(true);
    expect(f.allow.amounts.has(30)).toBe(true);
    expect(f.allow.amounts.has(999)).toBe(false);
    // $230 deposited: the top-up to Team MM ($500) is $270.
    expect(f.allow.amounts.has(270)).toBe(true);
    expect(f.allow.urls).toContain("https://www.tradingview.com");
  });
});
