import { describe, it, expect, vi } from "vitest";
import {
  runBurst, handleOutgoing, PREFIX, RUN_BUDGET_MS, MAX_REPLIES_PER_HOUR, MAX_CALLS_PER_DAY,
  type RunDeps, type BurstTrigger,
} from "./run";
import type { ChatRow, EventRow } from "./store";
import type { ContactInfo, Decision, SupportSettings, ThreadMessage } from "./types";

type Sp = RunDeps["sp"];

const settings: SupportSettings = {
  enabled: true, bonus_code: "TeamMM001", bonus_code_expires: "2026-12-15",
  official_accounts: [{ handle: "MM_3000", label: "Admin Amelia" }],
  office_hours: "during Singapore office hours", trade_cadence: "x", notes: "", approved_flows: [],
};
const NOW = new Date("2026-09-15T04:00:30Z");
const T0 = "2026-09-15T04:00:00Z";
const msg = (id: string, direction: "in" | "out", text: string, at = T0, fromFlow = false): ThreadMessage =>
  ({ id, direction, text, at, fromFlow });
const reply = (text: string, extra: Partial<Decision> = {}): Decision =>
  ({ action: "reply", topic: "plans", confidence: 0.9, reply: text, reason: "facts", ...extra });
/** Trigger matching a given message so `runBurst` treats it as still current. */
const trig = (text: string, at = T0): BurstTrigger => ({ at, text });

function setup(opts: {
  thread: ThreadMessage[];
  contact?: Partial<ContactInfo>;
  decisions?: (Decision | null)[];
  chat?: ChatRow | null;
  settings?: SupportSettings | null;
  now?: () => Date;
  sendResult?: boolean;
  getMessagesImpl?: () => Promise<ThreadMessage[]>;
  repliesInLastHour?: number;
  modelCallsToday?: number;
}) {
  const events: EventRow[] = [];
  let chat: ChatRow | null = opts.chat ?? null;
  const decisions = [...(opts.decisions ?? [])];
  const sp = {
    getMessages: vi.fn<Sp["getMessages"]>(opts.getMessagesImpl ?? (async () => opts.thread)),
    getContact: vi.fn<Sp["getContact"]>(async () => ({ id: "c1", username: "sam", firstName: "Sam", isBusiness: false, tags: [], ...opts.contact })),
    send: vi.fn<Sp["send"]>(async () => opts.sendResult ?? true),
    setTag: vi.fn<Sp["setTag"]>(async () => true),
    setPauseAutomation: vi.fn<Sp["setPauseAutomation"]>(async () => true),
    openChat: vi.fn<Sp["openChat"]>(async () => true),
  } satisfies Sp;
  const decide = vi.fn<RunDeps["decide"]>(async () => {
    const d = decisions.shift() ?? null;
    return { decision: d, refused: false, model: "claude-opus-5" };
  });
  const ping = vi.fn(async () => ({}));
  const sleep = vi.fn(async () => {});
  const deps: RunDeps = {
    store: {
      getSettings: async () => (opts.settings === undefined ? settings : opts.settings),
      getChat: async () => chat,
      saveChat: async (p) => { chat = { ...(chat ?? { contact_id: p.contact_id, state: "auto" }), ...p }; },
      countRepliesSince: async () => opts.repliesInLastHour ?? events.filter((e) => e.kind === "reply").length,
      countModelCallsSince: async () => opts.modelCallsToday ?? 0,
      recentAgentTexts: async () => events.map((e) => e.reply_text).filter((t): t is string => Boolean(t)),
      log: async (e) => { events.push(e); return true; },
    },
    sp,
    decide,
    findMember: vi.fn(async () => null),
    ping,
    sleep,
    now: opts.now ?? (() => NOW),
  };
  return { deps, sp, decide, ping, sleep, events, get chat() { return chat; } };
}

describe("runBurst", () => {
  it("replies with the drafted text and logs it", async () => {
    const s = setup({ thread: [msg("1", "in", "How much to join?")], decisions: [reply("Foundation starts at $50: https://app.marketmakersfx.net/upgrade")] });
    await expect(runBurst("c1", trig("How much to join?"), s.deps)).resolves.toMatchObject({ kind: "reply" });
    expect(s.sp.send).toHaveBeenCalledWith("c1", "Foundation starts at $50: https://app.marketmakersfx.net/upgrade");
    expect(s.events.at(-1)).toMatchObject({ kind: "reply", topic: "plans" });
  });

  it("prefixes replies in Amelia's-account chats", async () => {
    const s = setup({ thread: [msg("1", "in", "trial length?")], contact: { isBusiness: true }, decisions: [reply("The trial is 14 days.", { topic: "trial" })] });
    await runBurst("c1", trig("trial length?"), s.deps);
    expect(s.sp.send).toHaveBeenCalledWith("c1", `${PREFIX}The trial is 14 days.`);
  });

  it("stays out when a SendPulse flow already answered", async () => {
    const s = setup({ thread: [msg("1", "in", "Malaysia"), msg("2", "out", "Last one — where are you based?", "2026-09-15T04:00:02Z", true)] });
    await expect(runBurst("c1", trig("Malaysia"), s.deps)).resolves.toMatchObject({ kind: "skip", reason: "flow answered" });
    expect(s.decide).not.toHaveBeenCalled();
    expect(s.sp.send).not.toHaveBeenCalled();
  });

  it("hands money questions to Amelia without calling Claude", async () => {
    const s = setup({ thread: [msg("1", "in", "How do I withdraw my money?")] });
    await expect(runBurst("c1", trig("How do I withdraw my money?"), s.deps)).resolves.toMatchObject({ kind: "handoff", reason: "withdrawal" });
    expect(s.decide).not.toHaveBeenCalled();
    expect(s.sp.send).toHaveBeenCalledWith("c1", expect.stringContaining("passed this to Admin Amelia"));
    expect(s.sp.setTag).toHaveBeenCalledWith("c1", "needs-amelia");
    expect(s.sp.setPauseAutomation).toHaveBeenCalledWith("c1", 1440);
    expect(s.sp.openChat).toHaveBeenCalledWith("c1");
    expect(s.chat?.state).toBe("needs_amelia");
    expect(s.deps.ping).toHaveBeenCalled();
  });

  it("redrafts once after a guard failure, then sends the fixed reply", async () => {
    const s = setup({ thread: [msg("1", "in", "min deposit?")], decisions: [reply("The minimum is USD100."), reply("Foundation starts at $50.")] });
    await expect(runBurst("c1", trig("min deposit?"), s.deps)).resolves.toMatchObject({ kind: "reply" });
    expect(s.decide).toHaveBeenCalledTimes(2);
    expect(((s.decide.mock.calls[1] as unknown[])[0] as { retryReasons: string[] }).retryReasons[0]).toContain("amount");
    expect(s.sp.send).toHaveBeenCalledWith("c1", "Foundation starts at $50.");
  });

  it("hands off when the redraft still fails the guard", async () => {
    const s = setup({ thread: [msg("1", "in", "min deposit?")], decisions: [reply("USD100."), reply("Still USD100.")] });
    await expect(runBurst("c1", trig("min deposit?"), s.deps)).resolves.toMatchObject({ kind: "handoff" });
    expect(s.events.at(-1)?.guard_failures?.[0]).toContain("amount");
  });

  it("on a model error, sends the member nothing and flags the chat", async () => {
    const s = setup({ thread: [msg("1", "in", "question?")], decisions: [null] });
    await expect(runBurst("c1", trig("question?"), s.deps)).resolves.toMatchObject({ kind: "handoff" });
    expect(s.sp.send).not.toHaveBeenCalled();
    expect(s.sp.setTag).toHaveBeenCalledWith("c1", "needs-amelia");
  });

  it("does nothing while switched off", async () => {
    const s = setup({ thread: [msg("1", "in", "hi")], settings: { ...settings, enabled: false } });
    await expect(runBurst("c1", trig("hi"), s.deps)).resolves.toMatchObject({ kind: "skip", reason: "switched off" });
    expect(s.sp.getMessages).not.toHaveBeenCalled();
  });

  it("leaves Needs-Amelia chats alone", async () => {
    const s = setup({ thread: [msg("1", "in", "hi")], chat: { contact_id: "c1", state: "needs_amelia" } });
    await expect(runBurst("c1", trig("hi"), s.deps)).resolves.toMatchObject({ kind: "skip", reason: "needs_amelia" });
  });

  it("stops early when the reply cap is already hit for this hour", async () => {
    const s = setup({ thread: [msg("1", "in", "hi")], repliesInLastHour: MAX_REPLIES_PER_HOUR });
    await expect(runBurst("c1", trig("hi"), s.deps)).resolves.toMatchObject({ kind: "handoff", reason: "reply cap reached" });
    expect(s.decide).not.toHaveBeenCalled();
  });

  it("stops early when the daily model-call cap is already hit", async () => {
    const s = setup({ thread: [msg("1", "in", "hi")], modelCallsToday: MAX_CALLS_PER_DAY });
    await expect(runBurst("c1", trig("hi"), s.deps)).resolves.toMatchObject({ kind: "handoff", reason: "daily cap reached" });
    expect(s.decide).not.toHaveBeenCalled();
  });

  // --- (a) Never re-send after a failed send -------------------------------
  it("does not retry a failed send — hands off instead", async () => {
    const s = setup({
      thread: [msg("1", "in", "How much to join?")],
      decisions: [reply("Foundation starts at $50.")],
      sendResult: false,
    });
    await expect(runBurst("c1", trig("How much to join?"), s.deps)).resolves.toMatchObject({ kind: "handoff" });
    expect(s.sp.send).toHaveBeenCalledTimes(1);
    // No holding line sent on top — the real reply may already have gone out.
    expect(s.events.at(-1)).toMatchObject({ kind: "handoff", skip_reason: "send failed or unconfirmed" });
  });

  // --- (b) Overall deadline -------------------------------------------------
  it("hands off as 'out of time' instead of redrafting when the budget is nearly spent", async () => {
    let calls = 0;
    const fakeNow = () => {
      calls += 1;
      // 1st call: startedAt. 2nd: the frozen "now" used throughout. 3rd (only
      // reached after a guard failure): the elapsed-budget check — put it
      // 61s later, leaving 39s < REDRAFT_MIN_BUDGET_MS (40s) of budget.
      return calls <= 2 ? NOW : new Date(NOW.getTime() + 61_000);
    };
    const s = setup({ thread: [msg("1", "in", "min deposit?")], decisions: [reply("The minimum is USD100.")], now: fakeNow });
    await expect(runBurst("c1", trig("min deposit?"), s.deps)).resolves.toMatchObject({ kind: "handoff", reason: "out of time" });
    expect(s.decide).toHaveBeenCalledTimes(1);
  });

  it("still redrafts when plenty of budget remains", async () => {
    const s = setup({
      thread: [msg("1", "in", "min deposit?")],
      decisions: [reply("The minimum is USD100."), reply("Foundation starts at $50.")],
      now: () => NOW,
    });
    await expect(runBurst("c1", trig("min deposit?"), s.deps)).resolves.toMatchObject({ kind: "reply" });
    expect(s.decide).toHaveBeenCalledTimes(2);
  });

  // --- (c) A thrown read must hand off, not just log -------------------------
  it("hands off to Amelia when getMessages throws", async () => {
    const s = setup({
      thread: [],
      getMessagesImpl: async () => { throw new Error("SendPulse getMessages failed: 500"); },
    });
    await expect(runBurst("c1", trig("hi"), s.deps)).resolves.toMatchObject({ kind: "error" });
    expect(s.events.at(-1)).toMatchObject({ kind: "error" });
    expect(s.chat?.state).toBe("needs_amelia");
    expect(s.deps.ping).toHaveBeenCalled();
    // Best-effort only — never a holding line to the member when SendPulse
    // reads are already failing.
    expect(s.sp.send).not.toHaveBeenCalled();
  });

  // --- (d) Re-check the redraft's topic --------------------------------------
  it("hands off when the redraft itself turns into a money question", async () => {
    const s = setup({
      thread: [msg("1", "in", "min deposit?")],
      decisions: [
        reply("The minimum is USD100."),
        reply("Understood, thanks for letting us know.", { topic: "money" }),
      ],
    });
    const result = await runBurst("c1", trig("min deposit?"), s.deps);
    expect(result).toMatchObject({ kind: "handoff", reason: "money topic" });
    expect(s.sp.send).not.toHaveBeenCalledWith("c1", "Understood, thanks for letting us know.");
  });

  // --- (f) Burst matching -----------------------------------------------------
  it("skips as 'newer message' when a different, newer member message has arrived", async () => {
    const s = setup({ thread: [msg("1", "in", "Hi", T0), msg("2", "in", "Sir?", "2026-09-15T04:00:10Z")] });
    await expect(runBurst("c1", trig("Hi", T0), s.deps)).resolves.toMatchObject({ kind: "skip", reason: "newer message" });
    expect(s.decide).not.toHaveBeenCalled();
  });

  it("proceeds when the trigger text matches the thread's latest member message", async () => {
    const s = setup({
      thread: [msg("1", "in", "Hi", T0), msg("2", "in", "Sir?", "2026-09-15T04:00:10Z")],
      decisions: [reply("Hi! How can I help?")],
    });
    await expect(runBurst("c1", trig("Sir?", "2026-09-15T04:00:10Z"), s.deps)).resolves.toMatchObject({ kind: "reply" });
  });

  it("falls back to a time check when the trigger text is empty (media)", async () => {
    const s = setup({
      thread: [msg("1", "in", "[attachment]", "2026-09-15T04:00:01Z")],
      decisions: [reply("Got it, thanks!")],
    });
    // Within the 2s tolerance of the trigger's own timestamp — proceeds.
    await expect(runBurst("c1", { at: "2026-09-15T04:00:00Z", text: "" }, s.deps)).resolves.toMatchObject({ kind: "reply" });
  });

  it("skips via the time fallback when a later media message has arrived", async () => {
    const s = setup({ thread: [msg("1", "in", "[attachment]", "2026-09-15T04:00:05Z")] });
    await expect(runBurst("c1", { at: "2026-09-15T04:00:00Z", text: "" }, s.deps)).resolves.toMatchObject({ kind: "skip", reason: "newer message" });
    expect(s.decide).not.toHaveBeenCalled();
  });
});

describe("handleOutgoing", () => {
  it("goes quiet for an hour when a person replies", async () => {
    const s = setup({ thread: [msg("1", "in", "hi"), msg("2", "out", "Hi, Amelia here!", "2026-09-15T04:00:20Z")] });
    await expect(handleOutgoing("c1", s.deps)).resolves.toBe("amelia_reply");
    expect(s.chat?.state).toBe("quiet");
    expect(s.chat?.quiet_until).toBe("2026-09-15T05:00:30.000Z");
  });

  it("ignores its own echoes and flow messages", async () => {
    const s = setup({ thread: [msg("1", "in", "hi"), msg("2", "out", "Where are you based?", T0, true)] });
    await expect(handleOutgoing("c1", s.deps)).resolves.toBe("ignored");
  });

  // --- (e) The echo race -------------------------------------------------
  it("waits before reading, so a just-sent reply isn't mistaken for Amelia", async () => {
    const s = setup({ thread: [msg("1", "in", "hi"), msg("2", "out", "Foundation starts at $50.", "2026-09-15T04:00:20Z")] });
    // Simulate the agent's own reply having just been logged (by runBurst,
    // before it called sp.send) with the exact same text.
    s.events.push({ contact_id: "c1", kind: "reply", reply_text: "Foundation starts at $50." });
    await expect(handleOutgoing("c1", s.deps)).resolves.toBe("ignored");
    expect(s.sleep).toHaveBeenCalledWith(5000);
  });

  it("still goes quiet when the outgoing text doesn't match anything the agent logged", async () => {
    const s = setup({ thread: [msg("1", "in", "hi"), msg("2", "out", "Different text entirely.", "2026-09-15T04:00:20Z")] });
    s.events.push({ contact_id: "c1", kind: "reply", reply_text: "Foundation starts at $50." });
    await expect(handleOutgoing("c1", s.deps)).resolves.toBe("amelia_reply");
    expect(s.chat?.state).toBe("quiet");
  });

  // --- (h) handleOutgoing must not throw -----------------------------------
  it("logs an error and returns 'ignored' instead of throwing when a read fails", async () => {
    const s = setup({
      thread: [],
      getMessagesImpl: async () => { throw new Error("SendPulse getMessages failed: 500"); },
    });
    await expect(handleOutgoing("c1", s.deps)).resolves.toBe("ignored");
    expect(s.events.at(-1)).toMatchObject({ kind: "error" });
  });
});

// Sanity check on the budget constant referenced by the test above.
describe("RUN_BUDGET_MS", () => {
  it("leaves headroom under the webhook route's 120s ceiling", () => {
    expect(RUN_BUDGET_MS).toBeLessThan(120_000);
  });
});
