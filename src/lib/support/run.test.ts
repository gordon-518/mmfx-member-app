import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/telegram", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/telegram")>();
  return { ...actual, sendTelegram: vi.fn(async () => ({ ok: true, detail: {} })) };
});

import { sendTelegram } from "@/lib/telegram";
import {
  runBurst, handleOutgoing, defaultPing, PREFIX, RUN_BUDGET_MS, REDRAFT_MIN_BUDGET_MS, REDRAFT_TIMEOUT_MS,
  FIRST_DECIDE_MIN_BUDGET_MS, MAX_REPLIES_PER_HOUR, MAX_CALLS_PER_DAY, WAIT_MS, ECHO_WINDOW_MS,
  type RunDeps, type BurstTrigger,
} from "./run";
import type { ChatRow, EventRow, LogResult } from "./store";
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
  /** Called from inside the `sleep` fake — lets a test mutate chat state
   * "during" the debounce (e.g. Amelia taking the chat over). */
  duringSleep?: (setChat: (row: ChatRow | null) => void) => void;
  /** Called from inside the `decide` fake, after popping a decision — lets
   * a test advance a settable fake clock as if drafting took a long time. */
  duringDecide?: () => void;
}) {
  const events: EventRow[] = [];
  const usedDedupeKeys = new Set<string>();
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
    opts.duringDecide?.();
    return { decision: d, refused: false, model: "claude-opus-5" };
  });
  const ping = vi.fn<RunDeps["ping"]>(async () => ({ ok: true }));
  const sleep = vi.fn(async () => { opts.duringSleep?.((row) => { chat = row; }); });
  const deps: RunDeps = {
    store: {
      getSettings: async () => (opts.settings === undefined ? settings : opts.settings),
      getChat: async () => chat,
      saveChat: async (p) => { chat = { ...(chat ?? { contact_id: p.contact_id, state: "auto" }), ...p }; },
      countRepliesSince: async () => opts.repliesInLastHour ?? events.filter((e) => e.kind === "reply").length,
      countModelCallsSince: async () => opts.modelCallsToday ?? 0,
      recentAgentTexts: async () => events.map((e) => e.reply_text).filter((t): t is string => Boolean(t)),
      // Emulates support_events' real unique index on dedupe_key: the first
      // insert with a given key wins, a later one with the same key comes
      // back "duplicate" (nothing is pushed), and a null/absent key never
      // collides with anything (a standard unique index allows many nulls).
      log: async (e): Promise<LogResult> => {
        if (e.dedupe_key) {
          if (usedDedupeKeys.has(e.dedupe_key)) return { status: "duplicate" };
          usedDedupeKeys.add(e.dedupe_key);
        }
        events.push(e);
        return { status: "ok" };
      },
      markDelivered: async (dedupeKey) => {
        const ev = events.find((e) => e.dedupe_key === dedupeKey);
        if (ev) ev.delivered_at = new Date().toISOString();
      },
      patchSkipReason: async (dedupeKey, skipReason) => {
        const ev = events.find((e) => e.dedupe_key === dedupeKey);
        if (ev) ev.skip_reason = skipReason;
      },
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
    expect(((s.decide.mock.calls[1] as unknown[])[0] as { timeoutMs?: number }).timeoutMs).toBe(REDRAFT_TIMEOUT_MS);
    expect(s.sp.send).toHaveBeenCalledWith("c1", "Foundation starts at $50.");
    expect(s.events.at(-1)).toMatchObject({ kind: "reply", guard_failures: expect.arrayContaining([expect.stringContaining("amount")]) });
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
  it("does not retry a failed send — hands off instead, without re-claiming its own row", async () => {
    const s = setup({
      thread: [msg("1", "in", "How much to join?")],
      decisions: [reply("Foundation starts at $50.")],
      sendResult: false,
    });
    await expect(runBurst("c1", trig("How much to join?"), s.deps)).resolves.toMatchObject({ kind: "handoff" });
    expect(s.sp.send).toHaveBeenCalledTimes(1);
    // No holding line sent on top — the real reply may already have gone out.
    expect(s.events.at(-1)).toMatchObject({ kind: "handoff", skip_reason: "send failed or unconfirmed" });
    // The reply row was claimed (and left undelivered); the handoff row that
    // follows in the same run must not try to claim the same key again.
    expect(s.events.find((e) => e.kind === "reply")?.delivered_at).toBeUndefined();
  });

  // --- (b) Overall deadline -------------------------------------------------
  it("hands off as 'out of time' before even calling decide when the budget is already nearly spent", async () => {
    let clock = NOW.getTime();
    const now = () => new Date(clock);
    const s = setup({
      thread: [msg("1", "in", "hi")],
      now,
      duringSleep: () => { clock += 60_000; }, // simulate the debounce itself running long
    });
    await expect(runBurst("c1", trig("hi"), s.deps)).resolves.toMatchObject({ kind: "handoff", reason: "out of time" });
    expect(s.decide).not.toHaveBeenCalled();
  });

  it("hands off as 'out of time' instead of redrafting when the budget is nearly spent", async () => {
    let clock = NOW.getTime();
    const now = () => new Date(clock);
    const s = setup({
      thread: [msg("1", "in", "min deposit?")],
      decisions: [reply("The minimum is USD100.")],
      now,
      // Simulate the first draft call itself taking a long time: elapsed
      // budget after it must fall under REDRAFT_MIN_BUDGET_MS (55s).
      duringDecide: () => { clock += 61_000; },
    });
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

  // --- (item 5) getChat / getSettings must fail closed, never fail open ------
  it("hands off to Amelia (never replies) when getChat throws", async () => {
    const s = setup({ thread: [msg("1", "in", "hi")], decisions: [reply("Hi!")] });
    s.deps.store.getChat = async () => { throw new Error("support_chats read failed: pooler timeout"); };
    await expect(runBurst("c1", trig("hi"), s.deps)).resolves.toMatchObject({ kind: "error" });
    expect(s.chat?.state).toBe("needs_amelia");
    expect(s.sp.send).not.toHaveBeenCalled();
    expect(s.decide).not.toHaveBeenCalled();
  });

  it("hands off to Amelia (never replies) when getSettings throws", async () => {
    const s = setup({ thread: [msg("1", "in", "hi")], decisions: [reply("Hi!")] });
    s.deps.store.getSettings = async () => { throw new Error("support_settings read failed: pooler timeout"); };
    await expect(runBurst("c1", trig("hi"), s.deps)).resolves.toMatchObject({ kind: "error" });
    expect(s.chat?.state).toBe("needs_amelia");
    expect(s.sp.send).not.toHaveBeenCalled();
    expect(s.decide).not.toHaveBeenCalled();
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
    // Within the tolerance of the trigger's own timestamp — proceeds.
    await expect(runBurst("c1", { at: "2026-09-15T04:00:00Z", text: "" }, s.deps)).resolves.toMatchObject({ kind: "reply" });
  });

  // --- (item 11) Media path must fail open on clock skew, not closed ---------
  it("proceeds via the time fallback even when latest.at is *older* than the trigger (clock skew)", async () => {
    const s = setup({
      thread: [msg("1", "in", "[attachment]", "2026-09-15T03:59:00Z")], // 60s "older" than the trigger's own at
      decisions: [reply("Got it, thanks!")],
    });
    await expect(runBurst("c1", { at: "2026-09-15T04:00:00Z", text: "" }, s.deps)).resolves.toMatchObject({ kind: "reply" });
  });

  it("skips via the time fallback when a clearly newer media message has arrived", async () => {
    const s = setup({ thread: [msg("1", "in", "[attachment]", "2026-09-15T04:10:00Z")] }); // 10 minutes newer
    await expect(runBurst("c1", { at: "2026-09-15T04:00:00Z", text: "" }, s.deps)).resolves.toMatchObject({ kind: "skip", reason: "newer message" });
    expect(s.decide).not.toHaveBeenCalled();
  });

  // --- (item 4) Amelia must never be talked over during the debounce --------
  it("skips and never sends when the chat goes quiet during the debounce (Amelia took over)", async () => {
    const s = setup({
      thread: [msg("1", "in", "hi")],
      decisions: [reply("Hi! How can I help?")],
      duringSleep: (setChat) => setChat({ contact_id: "c1", state: "quiet", quiet_until: "2026-09-15T05:00:00Z" }),
    });
    await expect(runBurst("c1", trig("hi"), s.deps)).resolves.toMatchObject({ kind: "skip", reason: "quiet" });
    expect(s.sp.send).not.toHaveBeenCalled();
    expect(s.decide).not.toHaveBeenCalled();
  });

  it("skips when the chat is moved to needs_amelia during the debounce", async () => {
    const s = setup({
      thread: [msg("1", "in", "hi")],
      decisions: [reply("Hi! How can I help?")],
      duringSleep: (setChat) => setChat({ contact_id: "c1", state: "needs_amelia" }),
    });
    await expect(runBurst("c1", trig("hi"), s.deps)).resolves.toMatchObject({ kind: "skip", reason: "needs_amelia" });
    expect(s.sp.send).not.toHaveBeenCalled();
    expect(s.decide).not.toHaveBeenCalled();
  });

  // --- (item 1) The dedupe claim: no member gets the same reply twice -------
  describe("the outcome claim (item 1)", () => {
    it("answers the same member message only once across two sequential runs", async () => {
      const s = setup({
        thread: [msg("m1", "in", "hi")],
        decisions: [reply("Hi! How can I help?"), reply("Hi! How can I help?")],
      });
      await expect(runBurst("c1", trig("hi"), s.deps)).resolves.toMatchObject({ kind: "reply" });
      const eventsAfterFirst = s.events.length;
      await expect(runBurst("c1", trig("hi"), s.deps)).resolves.toMatchObject({ kind: "skip", reason: "already answered" });
      expect(s.sp.send).toHaveBeenCalledTimes(1);
      expect(s.events.length).toBe(eventsAfterFirst); // logs nothing extra
    });

    it("still answers two different member messages once each", async () => {
      let call = 0;
      const threads = [
        [msg("m1", "in", "hi")],
        [msg("m1", "in", "hi"), msg("m2", "in", "another question", "2026-09-15T04:05:00Z")],
      ];
      const s = setup({
        thread: [],
        getMessagesImpl: async () => threads[call++],
        decisions: [reply("Hi!"), reply("Sure, here you go.")],
      });
      await expect(runBurst("c1", trig("hi"), s.deps)).resolves.toMatchObject({ kind: "reply" });
      await expect(runBurst("c1", trig("another question", "2026-09-15T04:05:00Z"), s.deps)).resolves.toMatchObject({ kind: "reply" });
      expect(s.sp.send).toHaveBeenCalledTimes(2);
    });

    it("two photos in a row (empty text, within the media tolerance) still get exactly one reply", async () => {
      const thread = [msg("p1", "in", "[attachment]", "2026-09-15T04:00:00Z")];
      const s = setup({ thread, decisions: [reply("Got it, thanks!"), reply("Got it, thanks!")] });
      const trigger: BurstTrigger = { at: "2026-09-15T04:00:00Z", text: "" };
      await expect(runBurst("c1", trigger, s.deps)).resolves.toMatchObject({ kind: "reply" });
      await expect(runBurst("c1", trigger, s.deps)).resolves.toMatchObject({ kind: "skip", reason: "already answered" });
      expect(s.sp.send).toHaveBeenCalledTimes(1);
    });

    it("the handoff claim guards the same namespace as the reply claim", async () => {
      // First run claims dedupeKey via the handoff path (a hard handoff, no
      // decide() call). A second run answering the identical message must
      // be rejected by that same claim, with no side effects at all —
      // proving reply and handoff share one dedupe namespace, not two.
      const s = setup({ thread: [msg("m1", "in", "How do I withdraw my money?")] });
      await expect(runBurst("c1", trig("How do I withdraw my money?"), s.deps)).resolves.toMatchObject({ kind: "handoff" });
      // Reset the chat back to "auto" so the second run reaches the dedupe
      // claim itself, rather than being turned away earlier by the
      // needs_amelia guard — isolating the handoff-claim behaviour.
      await s.deps.store.saveChat({ contact_id: "c1", state: "auto" });
      s.sp.setTag.mockClear(); s.sp.send.mockClear();
      await expect(runBurst("c1", trig("How do I withdraw my money?"), s.deps)).resolves.toMatchObject({ kind: "skip", reason: "already answered" });
      expect(s.sp.send).not.toHaveBeenCalled();
      expect(s.sp.setTag).not.toHaveBeenCalled();
    });
  });

  // --- (item 6) Handoff ping: never the wrong Telegram chat, always redacted -
  describe("the handoff ping (item 6)", () => {
    it("redacts emails and phone numbers from the member text before pinging Telegram", async () => {
      const text = "How do I withdraw my money? call me at 012-3456789 or email sam@example.com";
      const s = setup({ thread: [msg("1", "in", text)] });
      await runBurst("c1", trig(text), s.deps);
      const html = s.ping.mock.calls.at(-1)?.[0] as string;
      expect(html).not.toContain("sam@example.com");
      expect(html).not.toContain("012-3456789");
      expect(html).toContain("[email]");
    });

    it("completes the handoff even when the ping fails to send", async () => {
      const s = setup({ thread: [msg("1", "in", "How do I withdraw my money?")] });
      s.deps.ping = vi.fn(async () => ({ ok: false }));
      await expect(runBurst("c1", trig("How do I withdraw my money?"), s.deps)).resolves.toMatchObject({ kind: "handoff" });
      expect(s.chat?.state).toBe("needs_amelia");
      expect(s.events.at(-1)?.skip_reason).toContain("write failed: ping");
    });

    it("records every failed handoff write, not just the ping", async () => {
      const s = setup({ thread: [msg("1", "in", "How do I withdraw my money?")] });
      s.sp.setTag = vi.fn(async () => false);
      s.deps.ping = vi.fn(async () => ({ ok: false }));
      await runBurst("c1", trig("How do I withdraw my money?"), s.deps);
      const ev = s.events.find((e) => e.kind === "handoff");
      expect(ev?.skip_reason).toContain("setTag");
      expect(ev?.skip_reason).toContain("ping");
    });
  });

  describe("defaultPing (item 6)", () => {
    afterEach(() => {
      delete process.env.SUPPORT_PING_CHAT_ID;
      vi.mocked(sendTelegram).mockClear();
    });

    it("never sends, and never falls back to TELEGRAM_CHAT_ID, when SUPPORT_PING_CHAT_ID is unset", async () => {
      delete process.env.SUPPORT_PING_CHAT_ID;
      const result = await defaultPing("hi");
      expect(sendTelegram).not.toHaveBeenCalled();
      expect(result.ok).toBe(false);
    });

    it("sends to SUPPORT_PING_CHAT_ID when it's set", async () => {
      process.env.SUPPORT_PING_CHAT_ID = "999";
      await defaultPing("hi");
      expect(sendTelegram).toHaveBeenCalledWith("hi", { chatId: "999" });
    });
  });

  // --- (item 9) A kill between the log and the send must leave delivered_at null
  describe("delivery marks (item 9)", () => {
    it("marks delivery after a successful reply send", async () => {
      const s = setup({ thread: [msg("1", "in", "How much to join?")], decisions: [reply("Foundation starts at $50.")] });
      await runBurst("c1", trig("How much to join?"), s.deps);
      expect(s.events.find((e) => e.kind === "reply")?.delivered_at).toBeTruthy();
    });

    it("leaves delivered_at unset when the send fails", async () => {
      const s = setup({ thread: [msg("1", "in", "How much to join?")], decisions: [reply("Foundation starts at $50.")], sendResult: false });
      await runBurst("c1", trig("How much to join?"), s.deps);
      expect(s.events.find((e) => e.kind === "reply")?.delivered_at).toBeUndefined();
    });

    it("marks delivery on the handoff holding line when it sends", async () => {
      const s = setup({ thread: [msg("1", "in", "How do I withdraw my money?")] });
      await runBurst("c1", trig("How do I withdraw my money?"), s.deps);
      expect(s.events.find((e) => e.kind === "handoff")?.delivered_at).toBeTruthy();
    });
  });

  // --- (item 13) One insert per run, proven via an interleaved send fake ----
  it("keeps the reply logged before the send resolves — a race with handleOutgoing sees it as an echo, not Amelia", async () => {
    const s = setup({ thread: [msg("1", "in", "How much to join?")], decisions: [reply("Foundation starts at $50.")] });
    let raceResult: "amelia_reply" | "ignored" | undefined;
    s.sp.send = vi.fn(async (contactId: string, text: string) => {
      // Simulate SendPulse's outgoing_message webhook firing (and being
      // processed) before send() itself resolves.
      raceResult = await handleOutgoing(contactId, {
        ...s.deps,
        sp: { ...s.deps.sp, getMessages: async () => [msg("1", "in", "How much to join?"), msg("2", "out", text, "2026-09-15T04:00:31Z")] },
      });
      return true;
    });
    await runBurst("c1", trig("How much to join?"), s.deps);
    expect(raceResult).toBe("ignored");
  });

  describe("RUN_BUDGET_MS", () => {
    it("keeps the worst-case burst (debounce + draft + redraft + send/handoff tail) under the route's 180s ceiling", () => {
      const debounce = WAIT_MS;
      const firstDecideMax = 35_000; // agent.ts's defaultClient default
      const tail = 10_000 /* send */ + 4 * 10_000; // on failure: setTag/pause/openChat/ping, each up to 10s
      expect(debounce + firstDecideMax + REDRAFT_TIMEOUT_MS + tail).toBeLessThan(180_000);
    });

    it("gates the redraft with a higher floor than the first decide, and a shorter timeout than the default draft call", () => {
      expect(REDRAFT_MIN_BUDGET_MS).toBeGreaterThan(FIRST_DECIDE_MIN_BUDGET_MS);
      expect(REDRAFT_TIMEOUT_MS).toBeLessThan(35_000);
      expect(RUN_BUDGET_MS).toBeGreaterThan(REDRAFT_MIN_BUDGET_MS);
    });
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

  // --- (item 10) Echo detection: normalise, recency, scan every message ------
  describe("brittle echo detection (item 10)", () => {
    it("treats a reply as its own echo despite extra whitespace (normalised comparison)", async () => {
      const s = setup({ thread: [msg("1", "in", "hi"), msg("2", "out", "  Foundation starts at $50.  ", "2026-09-15T04:00:20Z")] });
      s.events.push({ contact_id: "c1", kind: "reply", reply_text: "Foundation starts at $50." });
      await expect(handleOutgoing("c1", s.deps)).resolves.toBe("ignored");
    });

    it("only looks back ECHO_WINDOW_MS (2 minutes), not a longer window, for a matching logged reply", async () => {
      const s = setup({ thread: [msg("1", "in", "hi"), msg("2", "out", "Foundation starts at $50.", "2026-09-15T04:00:20Z")] });
      const recentAgentTexts = vi.fn(async () => []);
      s.deps.store.recentAgentTexts = recentAgentTexts;
      await handleOutgoing("c1", s.deps);
      expect(recentAgentTexts).toHaveBeenCalledWith("c1", new Date(NOW.getTime() - ECHO_WINDOW_MS).toISOString());
      expect(ECHO_WINDOW_MS).toBe(2 * 60_000);
    });

    it("scans every outgoing message since the member's last one, not just the newest", async () => {
      const s = setup({
        thread: [
          msg("1", "in", "hi"),
          msg("2", "out", "Hi, Amelia here!", "2026-09-15T04:00:15Z"),
          msg("3", "out", "Foundation starts at $50.", "2026-09-15T04:00:20Z"),
        ],
      });
      s.events.push({ contact_id: "c1", kind: "reply", reply_text: "Foundation starts at $50." });
      await expect(handleOutgoing("c1", s.deps)).resolves.toBe("amelia_reply");
      expect(s.chat?.state).toBe("quiet");
    });
  });
});
