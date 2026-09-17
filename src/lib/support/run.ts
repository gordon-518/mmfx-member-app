import "server-only";
import { adminDb } from "@/lib/channel/db";
import { sendTelegram, escapeHtml } from "@/lib/telegram";
import * as sendpulse from "./sendpulse";
import { decide as realDecide } from "./agent";
import { buildFactSheet } from "./facts";
import { checkDraft, mustHandOff } from "./guard";
import { findMember as realFindMember } from "./member";
import { supabaseStore, type SupportStore } from "./store";
import type { ContactInfo, MemberContext, SupportSettings, ThreadMessage } from "./types";

// The orchestrator. Every decision rule for one debounced burst of member
// messages lives here; the database is reached only through `SupportStore`
// (store.ts) and SendPulse only through the injected `sp`, so tests run
// against in-memory fakes with no real network or DB calls.

export const WAIT_MS = 20_000;
export const CONFIDENCE_MIN = 0.7;
export const MAX_REPLIES_PER_HOUR = 6;
export const MAX_CALLS_PER_DAY = 1500;
export const QUIET_MINUTES = 60;
export const HANDOFF_PAUSE_MINUTES = 1440;
export const PREFIX = "MMFX Assistant: ";
/**
 * Overall budget for one burst, measured from the top of `runBurst`. The
 * webhook route allows 120s total, which must fit the 20s debounce sleep, a
 * draft AND a possible redraft (agent.ts's client timeout is 35s each), plus
 * several SendPulse round trips — 100s leaves headroom under that ceiling.
 */
export const RUN_BUDGET_MS = 100_000;
/** Below this much remaining budget, skip the redraft and hand off instead —
 * a redraft call can itself take up to ~35s, so starting one this late could
 * blow the route's deadline. */
export const REDRAFT_MIN_BUDGET_MS = 40_000;
/** How far back "recent" reaches when deciding whether an outgoing message
 * was the agent's own (echo) rather than a human reply. */
const ECHO_WINDOW_MS = 30 * 60_000;
const TAG = "needs-amelia";

export interface RunDeps {
  store: SupportStore;
  sp: Pick<typeof sendpulse, "getMessages" | "getContact" | "send" | "setTag" | "setPauseAutomation" | "openChat">;
  decide: typeof realDecide;
  findMember: (opts: { texts: string[]; telegramUsername: string | null }) => Promise<MemberContext | null>;
  ping: (html: string) => Promise<unknown>;
  sleep: (ms: number) => Promise<void>;
  now: () => Date;
}

export function defaultDeps(): RunDeps {
  const db = adminDb();
  return {
    store: supabaseStore(db),
    sp: sendpulse,
    decide: realDecide,
    findMember: (o) => realFindMember(db, o),
    ping: (html) => sendTelegram(html, { chatId: process.env.SUPPORT_PING_CHAT_ID }),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => new Date(),
  };
}

export type RunOutcome = { kind: "reply" | "handoff" | "skip" | "error"; reason?: string };

/**
 * What tells `runBurst` it's still answering the message that triggered it:
 * the webhook's own `date` and the member's message text (Task 9's route
 * passes the webhook's `contact.last_message` as `text`). Comparing the
 * trigger's text against the thread's latest member message — rather than
 * trusting two unrelated clocks (the webhook's and SendPulse's
 * `created_at`) to agree within a tolerance — is what a media message (no
 * text) falls back to the time rule for.
 */
export interface BurstTrigger {
  at: string;
  text: string;
}

const minus = (d: Date, ms: number) => new Date(d.getTime() - ms).toISOString();
const plus = (d: Date, ms: number) => new Date(d.getTime() + ms).toISOString();
/** Midnight Singapore time (UTC+8) for the SGT day containing `d`. */
function sgtDayStart(d: Date): string {
  const sgt = new Date(d.getTime() + 8 * 3600_000);
  return new Date(Date.UTC(sgt.getUTCFullYear(), sgt.getUTCMonth(), sgt.getUTCDate()) - 8 * 3600_000).toISOString();
}

export async function runBurst(
  contactId: string,
  trigger: BurstTrigger,
  deps: RunDeps = defaultDeps()
): Promise<RunOutcome> {
  const { store, sp } = deps;
  // Measured before anything else so it covers the whole burst, including
  // the debounce sleep below — see RUN_BUDGET_MS.
  const startedAt = deps.now().getTime();
  const skip = async (reason: string): Promise<RunOutcome> => {
    await store.log({ contact_id: contactId, kind: "skip", skip_reason: reason });
    return { kind: "skip", reason };
  };

  try {
    const settings = await store.getSettings();
    if (!settings) return skip("no settings");
    if (!settings.enabled || process.env.SUPPORT_AGENT_ENABLED === "false") return skip("switched off");

    const chat = await store.getChat(contactId);
    if (chat?.state === "needs_amelia") return skip("needs_amelia");
    const now = deps.now();
    if (chat?.state === "quiet" && chat.quiet_until && Date.parse(chat.quiet_until) > now.getTime()) return skip("quiet");

    await deps.sleep(WAIT_MS);

    // Reads throw on failure (sendpulse.ts / member.ts contract) — a failed
    // thread read must never look like an empty one. A throw from here on
    // is handled by the catch block below: best-effort handoff to Amelia,
    // never a silently dropped chat.
    const thread = await sp.getMessages(contactId, 15);
    const lastIn = thread.map((m) => m.direction).lastIndexOf("in");
    if (lastIn === -1) return skip("no member message");
    const latest = thread[lastIn];

    // Only proceed when the thread's latest member message is still the one
    // that triggered this run — not a newer one that arrived during the
    // debounce (that message gets its own run). Text equality is the
    // primary check (see BurstTrigger); an empty trigger text (a media
    // message has none) falls back to a generous time-based tolerance.
    const triggerText = trigger.text.trim();
    const stillLatest = triggerText
      ? latest.text.trim() === triggerText
      : Math.abs(Date.parse(latest.at) - Date.parse(trigger.at)) <= 2000;
    if (!stillLatest) return skip("newer message");

    const after = thread.slice(lastIn + 1);
    if (after.some((m) => m.fromFlow)) return skip("flow answered");
    const ours = await store.recentAgentTexts(contactId, minus(now, ECHO_WINDOW_MS));
    if (after.some((m) => m.direction === "out" && !ours.includes(m.text))) {
      await store.saveChat({ contact_id: contactId, state: "quiet", quiet_until: plus(now, QUIET_MINUTES * 60_000) });
      return skip("answered by a person");
    }

    let start = lastIn;
    while (start > 0 && thread[start - 1].direction === "in") start--;
    const memberText = thread.slice(start, lastIn + 1).map((m) => m.text).filter(Boolean).join("\n");
    const memberTexts = thread.filter((m) => m.direction === "in").map((m) => m.text);

    const contact: ContactInfo = (await sp.getContact(contactId))
      ?? { id: contactId, username: null, firstName: "", isBusiness: false, tags: [] };
    const member = await deps.findMember({ texts: memberTexts, telegramUsername: contact.username });
    await store.saveChat({
      contact_id: contactId, state: "auto", is_business: contact.isBusiness,
      telegram_username: contact.username, matched_user_id: member?.userId ?? null,
      last_member_msg_at: latest.at,
    });

    const ctx = { deps, settings, contact, contactId, memberText };
    if ((await store.countRepliesSince(contactId, minus(now, 3600_000))) >= MAX_REPLIES_PER_HOUR) {
      return handoff(ctx, "reply cap reached");
    }
    if ((await store.countModelCallsSince(sgtDayStart(now))) >= MAX_CALLS_PER_DAY) {
      return handoff(ctx, "daily cap reached");
    }

    const hard = mustHandOff(memberText, "other");
    if (hard) return handoff(ctx, hard);

    const facts = buildFactSheet(settings, now);
    const started = Date.now();
    const first = await deps.decide({ facts, thread, contact, member });
    if (!first.decision) {
      // decide() never throws (agent.ts contract): a refusal and a genuine
      // model/schema error are both surfaced here, never as a thrown error.
      return handoff(
        ctx,
        first.refused ? "model refused" : `model error${first.error ? `: ${first.error}` : ""}`,
        { sendHolding: false, model: first.model }
      );
    }
    let d = first.decision;
    if (d.action === "handoff" || d.confidence < CONFIDENCE_MIN) {
      return handoff(ctx, d.reason || "model chose handoff", { model: first.model, topic: d.topic });
    }
    const topicHard = mustHandOff(memberText, d.topic);
    if (topicHard) return handoff(ctx, topicHard, { model: first.model, topic: d.topic });

    const guardCtx = { facts, memberTexts, member };
    const fails = checkDraft(d.reply, guardCtx);
    if (fails.length) {
      // Don't start a redraft this late — it can itself take ~35s, and the
      // route's deadline must still cover the handoff itself.
      const elapsed = deps.now().getTime() - startedAt;
      if (RUN_BUDGET_MS - elapsed < REDRAFT_MIN_BUDGET_MS) {
        return handoff(ctx, "out of time", { guardFailures: fails, model: first.model, topic: d.topic });
      }
      const second = await deps.decide({ facts, thread, contact, member, retryReasons: fails });
      const s = second.decision;
      if (!s || s.action !== "reply" || s.confidence < CONFIDENCE_MIN || checkDraft(s.reply, guardCtx).length) {
        return handoff(ctx, `guard: ${fails.join("; ")}`, { guardFailures: fails, model: first.model, topic: s?.topic ?? d.topic });
      }
      // The redraft can change topic (e.g. into a money question) — recheck
      // it exactly as the first draft's topic was checked above.
      const secondTopicHard = mustHandOff(memberText, s.topic);
      if (secondTopicHard) return handoff(ctx, secondTopicHard, { model: first.model, topic: s.topic });
      d = s;
    }

    const text = contact.isBusiness ? PREFIX + d.reply : d.reply;
    // Log BEFORE sending: SendPulse's outgoing_message webhook can fire
    // before `sp.send` even returns, so the reply must already be visible
    // to recentAgentTexts (see handleOutgoing) or it reads as a person
    // (Amelia) replying and the chat goes quiet for an hour after every
    // single answer.
    await store.log({
      contact_id: contactId, kind: "reply", member_text: memberText, topic: d.topic, confidence: d.confidence,
      reply_text: text, model: first.model, latency_ms: Date.now() - started,
    });
    const sent = await sp.send(contactId, text);
    if (!sent) {
      // sendpulse.ts contract: `false` means "not sent OR unknown" — it may
      // already have gone out. Re-sending risks a duplicate reply to the
      // member, so this hands off instead of retrying, with no holding line
      // (the member may already have received the real answer).
      return handoff(ctx, "send failed or unconfirmed", { sendHolding: false, model: first.model, topic: d.topic });
    }

    await store.saveChat({ contact_id: contactId, state: "auto", last_agent_reply_at: now.toISOString() });
    return { kind: "reply" };
  } catch (e) {
    // A thrown read (getMessages/getContact/findMember) must still reach a
    // human, not silently drop the chat. Best-effort: the write helpers
    // (setTag/setPauseAutomation/openChat) never throw, but SendPulse may
    // itself be down, so this is wrapped defensively; no holding line is
    // sent (SendPulse may be unreachable, and this must never throw again).
    const reason = e instanceof Error ? e.message : String(e);
    try {
      await sp.setTag(contactId, TAG);
      await sp.setPauseAutomation(contactId, HANDOFF_PAUSE_MINUTES);
      await sp.openChat(contactId);
      await store.saveChat({ contact_id: contactId, state: "needs_amelia", handoff_reason: reason });
      await deps.ping(`⚠️ <b>Support agent error</b> · contact ${escapeHtml(contactId)}\n<i>${escapeHtml(reason)}</i>`);
    } catch {
      // Best-effort only — the error event below is logged either way.
    }
    await store.log({ contact_id: contactId, kind: "error", skip_reason: reason }).catch(() => false);
    return { kind: "error", reason };
  }
}

async function handoff(
  ctx: { deps: RunDeps; settings: SupportSettings; contact: ContactInfo; contactId: string; memberText: string },
  reason: string,
  opts: { sendHolding?: boolean; guardFailures?: string[]; model?: string; topic?: string } = {}
): Promise<RunOutcome> {
  const { deps, settings, contact, contactId, memberText } = ctx;
  const sendHolding = opts.sendHolding !== false;
  const holding = `${contact.isBusiness ? PREFIX : ""}Thanks, I've passed this to Admin Amelia. She'll reply here ${settings.office_hours}.`;
  // Log BEFORE sending the holding line, for the same echo-race reason as
  // the main reply above.
  await deps.store.log({
    contact_id: contactId, kind: "handoff", member_text: memberText, topic: opts.topic, skip_reason: reason,
    reply_text: sendHolding ? holding : undefined, guard_failures: opts.guardFailures, model: opts.model,
  });
  if (sendHolding) await deps.sp.send(contactId, holding);
  await deps.sp.setTag(contactId, TAG);
  await deps.sp.setPauseAutomation(contactId, HANDOFF_PAUSE_MINUTES);
  await deps.sp.openChat(contactId);
  await deps.store.saveChat({ contact_id: contactId, state: "needs_amelia", handoff_reason: reason });
  await deps.ping(
    `🙋 <b>Needs Amelia</b> · ${escapeHtml(contact.firstName || "Member")}${contact.username ? ` (@${escapeHtml(contact.username)})` : ""}` +
    `\n“${escapeHtml(memberText.slice(0, 300))}”\n<i>Reason: ${escapeHtml(reason)}</i>`
  );
  return { kind: "handoff", reason };
}

/** An outgoing message the agent didn't send: a person replied, so go quiet. */
export async function handleOutgoing(contactId: string, deps: RunDeps = defaultDeps()): Promise<"amelia_reply" | "ignored"> {
  try {
    // SendPulse's outgoing_message webhook for the agent's own send can
    // arrive before that reply (or handoff holding line) is logged — wait
    // so a just-logged entry is visible to recentAgentTexts below. Without
    // this, the agent's own send would look like Amelia replying and put
    // the chat in a 60-minute quiet period after every single answer.
    await deps.sleep(5000);
    const thread: ThreadMessage[] = await deps.sp.getMessages(contactId, 5);
    const lastOut = [...thread].reverse().find((m) => m.direction === "out");
    if (!lastOut || lastOut.fromFlow) return "ignored";
    const ours = await deps.store.recentAgentTexts(contactId, minus(deps.now(), ECHO_WINDOW_MS));
    if (ours.includes(lastOut.text)) return "ignored";
    const chat = await deps.store.getChat(contactId);
    if (chat?.state !== "needs_amelia") {
      await deps.store.saveChat({ contact_id: contactId, state: "quiet", quiet_until: plus(deps.now(), QUIET_MINUTES * 60_000) });
    }
    await deps.store.log({ contact_id: contactId, kind: "amelia_reply", reply_text: lastOut.text });
    return "amelia_reply";
  } catch (e) {
    // Must never throw out of the webhook route's after() callback.
    await deps.store.log({ contact_id: contactId, kind: "error", skip_reason: e instanceof Error ? e.message : String(e) }).catch(() => false);
    return "ignored";
  }
}
