import "server-only";
import { buildFactSheet } from "@/lib/support/facts";
import { checkDraft, mustHandOff } from "@/lib/support/guard";
import type { FactSheet, MemberContext } from "@/lib/support/types";
import { sendTelegram } from "@/lib/telegram";
import { sendAdminAlert } from "@/lib/notify";
import { PUBLIC_CHANNEL_URL } from "@/lib/onboarding";
import { TIER_THRESHOLDS } from "@/lib/tiers";
import { decideChat } from "./agent";
import { buildAppGuide, CHAT_APP_PATHS, APP_URL } from "./guide";
import { supabaseChatStore, type ChatStore } from "./store";
import { MAX_MESSAGE_CHARS, type ChatMember, type ChatMessage } from "./types";

// One member message in, at most one assistant reply out. The assistant
// answers from the support FACTS and the APP GUIDE; anything it can't answer
// safely goes to a person (Gordon is pinged, and replies from /admin/chat).

export const CONFIDENCE_MIN = 0.7;
export const MAX_MEMBER_MESSAGES_PER_HOUR = 20;
export const MAX_ASSISTANT_CALLS_PER_DAY = 1000;
/** While a person has the thread, a new member message re-pings at most this often. */
export const REPING_MINUTES = 30;
const CONTEXT_MESSAGES = 20;

export type ChatOutcome =
  | { kind: "reply"; messages: ChatMessage[] }
  | { kind: "handoff"; messages: ChatMessage[]; reason: string }
  | { kind: "queued"; messages: ChatMessage[] }
  | { kind: "rate_limited" }
  | { kind: "invalid" };

export interface HandoffNotice {
  member: ChatMember;
  question: string;
  reason: string;
}

export interface ChatDeps {
  store: ChatStore;
  decide: typeof decideChat;
  notify: (n: HandoffNotice) => Promise<void>;
  now: () => Date;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The handoff ping: to SUPPORT_PING_CHAT_ID only (never the ops chat — the
 *  member's words are in it), plus an email, both best-effort. Outside
 *  production it only logs, so local testing never alerts the team. */
export async function defaultNotify(n: HandoffNotice): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[chat] handoff (not sent outside production): ${n.reason}`);
    return;
  }
  const question = n.question.length > 300 ? `${n.question.slice(0, 300)}…` : n.question;
  const link = `${APP_URL}/admin/chat?user=${n.member.userId}`;
  const lines = [
    `In-app chat needs a person (${n.reason})`,
    `Member: ${n.member.email ?? n.member.userId} · ${n.member.tier} · ${n.member.locale}`,
    `"${question}"`,
    `Reply: ${link}`,
  ];
  const chatId = process.env.SUPPORT_PING_CHAT_ID;
  const [tg, mail] = await Promise.all([
    chatId
      ? sendTelegram(
          [`<b>${esc(lines[0])}</b>`, esc(lines[1]), esc(lines[2]), `<a href="${link}">Reply in the app</a>`].join("\n"),
          { chatId }
        )
      : Promise.resolve({ ok: false, detail: "SUPPORT_PING_CHAT_ID not configured" }),
    sendAdminAlert(`In-app chat: ${n.reason}`, lines.join("\n")),
  ]);
  if (!tg.ok) console.error("[chat] handoff Telegram ping failed:", tg.detail);
  if (!mail.ok) console.error("[chat] handoff email failed:", mail.detail);
}

export function defaultChatDeps(): ChatDeps {
  return { store: supabaseChatStore(), decide: decideChat, notify: defaultNotify, now: () => new Date() };
}

/** Where the app guide sends members to find their TradingView @username. */
const TRADINGVIEW_URLS = ["https://tradingview.com", "https://www.tradingview.com"];

/** The support facts, widened to what an in-app answer may also quote: every
 *  app page, the public channel, TradingView, this member's own amounts, and
 *  the top-up from their total to each tier above it (what /upgrade shows). */
export function chatFacts(base: FactSheet, member: ChatMember): FactSheet {
  const own = [member.depositTotal, member.submission?.amount ?? null].filter((n): n is number => n != null && n > 0);
  const topUps = Object.values(TIER_THRESHOLDS)
    .filter((threshold) => threshold > member.depositTotal)
    .map((threshold) => Math.round((threshold - member.depositTotal) * 100) / 100);
  return {
    text: base.text,
    allow: {
      ...base.allow,
      amounts: new Set([...base.allow.amounts, ...own, ...topUps]),
      urls: [...base.allow.urls, PUBLIC_CHANNEL_URL, ...TRADINGVIEW_URLS],
      appPaths: [...new Set([...base.allow.appPaths, ...CHAT_APP_PATHS])],
    },
  };
}

/** The guard's view of the member: the session is the identity, so attested. */
function guardMember(m: ChatMember): MemberContext {
  return {
    userId: m.userId,
    matchedBy: "session",
    tier: m.tier,
    trialEndsAt: m.trialEndsAt,
    depositTotal: m.depositTotal,
    submission: m.submission
      ? { status: m.submission.status, rejectReason: null, createdAt: "", amount: m.submission.amount }
      : null,
    attested: true,
  };
}

export async function handleMemberMessage(
  member: ChatMember,
  raw: string,
  deps: ChatDeps = defaultChatDeps()
): Promise<ChatOutcome> {
  const text = raw.trim();
  if (!text || text.length > MAX_MESSAGE_CHARS) return { kind: "invalid" };
  const { store } = deps;
  const now = deps.now();

  const hourAgo = new Date(now.getTime() - 3600_000).toISOString();
  if ((await store.countMemberMessagesSince(member.userId, hourAgo)) >= MAX_MEMBER_MESSAGES_PER_HOUR) {
    return { kind: "rate_limited" };
  }

  const thread = await store.getThread(member.userId);
  const mine = await store.addMessage({ user_id: member.userId, role: "member", body: text });
  await store.saveThread({ user_id: member.userId, locale: member.locale, state: thread?.state ?? "bot" });

  // A person already has this thread: the message waits for them. Re-ping
  // only if the last ping is old, so a burst of messages is one alert.
  if (thread?.state === "needs_human") {
    const last = thread.last_ping_at ? Date.parse(thread.last_ping_at) : 0;
    if (now.getTime() - last > REPING_MINUTES * 60_000) {
      await deps.notify({ member, question: text, reason: "new message while waiting" });
      await store.saveThread({ user_id: member.userId, last_ping_at: now.toISOString() });
    }
    return { kind: "queued", messages: [mine] };
  }

  const handoff = async (reason: string, model?: string): Promise<ChatOutcome> => {
    const note = await store.addMessage({ user_id: member.userId, role: "system", body: "handoff", model: model ?? null });
    await store.saveThread({ user_id: member.userId, state: "needs_human", handoff_reason: reason, last_ping_at: now.toISOString() });
    await deps.notify({ member, question: text, reason });
    return { kind: "handoff", messages: [mine, note], reason };
  };

  const settings = await store.getSettings();
  if (!settings || settings.chat_enabled === false) return handoff("assistant switched off");

  const always = mustHandOff(text, "other");
  if (always) return handoff(always);

  const dayStart = new Date(now.getTime() - 24 * 3600_000).toISOString();
  if ((await store.countAssistantCallsSince(dayStart)) >= MAX_ASSISTANT_CALLS_PER_DAY) {
    return handoff("daily assistant budget reached");
  }

  const facts = chatFacts(buildFactSheet(settings, now), member);
  const guide = buildAppGuide();
  const thread20 = await store.recent(member.userId, CONTEXT_MESSAGES);
  const memberTexts = thread20.filter((m) => m.role === "member").map((m) => m.body);

  let attempt = await deps.decide({ facts, guide, thread: thread20, member });
  for (let round = 0; ; round++) {
    const d = attempt.decision;
    if (!d) return handoff(attempt.refused ? "model refused" : `model error: ${attempt.error ?? "unknown"}`, attempt.model);
    if (d.action === "handoff") return handoff(d.reason || "assistant handed off", attempt.model);
    if (d.confidence < CONFIDENCE_MIN) return handoff(`low confidence (${d.confidence})`, attempt.model);
    const must = mustHandOff(text, d.topic);
    if (must) return handoff(must, attempt.model);

    const failures = checkDraft(d.reply, { facts, memberTexts, member: guardMember(member) });
    if (failures.length === 0) {
      const reply = await store.addMessage({
        user_id: member.userId,
        role: "assistant",
        body: d.reply,
        topic: d.topic,
        confidence: d.confidence,
        model: attempt.model,
      });
      return { kind: "reply", messages: [mine, reply] };
    }
    if (round >= 1) return handoff(`draft failed the checks: ${failures.join("; ")}`, attempt.model);
    attempt = await deps.decide({ facts, guide, thread: thread20, member, retryReasons: failures });
  }
}
