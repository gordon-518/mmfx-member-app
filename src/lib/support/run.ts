import "server-only";
import { adminDb } from "@/lib/channel/db";
import { sendTelegram, escapeHtml } from "@/lib/telegram";
import * as sendpulse from "./sendpulse";
import { decide as realDecide, redactForModel } from "./agent";
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
 * Overall internal-accounting budget for one burst, measured from the top of
 * `runBurst` — it includes the 20s debounce sleep below. This is not itself
 * a hard cutoff; it only gates whether to *start* an expensive step (the
 * first `decide()` call, and a redraft after a guard failure — see
 * FIRST_DECIDE_MIN_BUDGET_MS / REDRAFT_MIN_BUDGET_MS below). The webhook
 * route's `maxDuration` is 180s (docs/superpowers/plans/2026-09-15-support-
 * agent.md, Task 9): debounce (20s, fixed) + a draft call (up to 35s,
 * agent.ts's defaultClient) + a possible redraft (up to REDRAFT_TIMEOUT_MS)
 * + the send/handoff tail (a send, and on failure up to four SendPulse
 * writes plus a Telegram ping, each up to 10s) comfortably fits under that
 * ceiling even in the worst case (~125s).
 */
export const RUN_BUDGET_MS = 100_000;
/** Below this much budget remaining, skip the first `decide()` call
 * entirely and hand off instead — a draft call can itself take up to ~35s,
 * and the route's deadline must still cover the send/handoff tail behind it. */
export const FIRST_DECIDE_MIN_BUDGET_MS = 45_000;
/** Below this much remaining budget, skip the redraft and hand off instead —
 * even at REDRAFT_TIMEOUT_MS, the redraft plus the send/handoff tail behind
 * it (see RUN_BUDGET_MS) must still fit under the route's deadline. */
export const REDRAFT_MIN_BUDGET_MS = 55_000;
/** Client-side timeout for the redraft call specifically — shorter than the
 * first draft's default (agent.ts's defaultClient, 35s) so a redraft that
 * starts this late can't itself blow the remaining budget. */
export const REDRAFT_TIMEOUT_MS = 20_000;
/** How far back "recent" reaches when deciding whether an outgoing message
 * was the agent's own (echo) rather than a human reply. Short on purpose:
 * a longer window would let Amelia copying the agent's own fixed holding
 * line, well after the fact, read as the agent's echo instead of hers. */
export const ECHO_WINDOW_MS = 2 * 60_000;
const TAG = "needs-amelia";

export interface RunDeps {
  store: SupportStore;
  sp: Pick<typeof sendpulse, "getMessages" | "getContact" | "send" | "setTag" | "setPauseAutomation" | "openChat">;
  decide: typeof realDecide;
  findMember: (opts: { texts: string[]; telegramUsername: string | null }) => Promise<MemberContext | null>;
  ping: (html: string) => Promise<{ ok: boolean }>;
  sleep: (ms: number) => Promise<void>;
  now: () => Date;
}

/** The default `ping` dep: sends only to SUPPORT_PING_CHAT_ID, never falling
 * back to TELEGRAM_CHAT_ID (the growth-stats/ops chat) the way `sendTelegram`
 * does when `chatId` is omitted — a handoff ping carries up to 300 chars of
 * member text (disputes, deletion requests included), and that chat's
 * audience must never see it. Unset/empty means "no ping configured": the
 * caller (see `handoff` below) records that rather than silently dropping it. */
export function defaultPing(html: string): Promise<{ ok: boolean; detail?: unknown }> {
  const chatId = process.env.SUPPORT_PING_CHAT_ID;
  if (!chatId) return Promise.resolve({ ok: false, detail: "SUPPORT_PING_CHAT_ID not configured" });
  return sendTelegram(html, { chatId });
}

export function defaultDeps(): RunDeps {
  const db = adminDb();
  return {
    store: supabaseStore(db),
    sp: sendpulse,
    decide: realDecide,
    findMember: (o) => realFindMember(db, o),
    ping: defaultPing,
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
/** Collapse whitespace for comparing two message texts that should be the
 * same wording — an untrimmed mismatch (trailing space, a double space)
 * must never flip the agent's own reply into "a person answered". */
const normaliseText = (s: string) => s.trim().replace(/\s+/g, " ");
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

    // Amelia (or anyone) could have taken the chat during the debounce —
    // handleOutgoing sets `quiet`/`needs_amelia` from a person's reply, and
    // a run that read `auto` before the sleep must not draft or send over
    // her just because it started first. Re-read and re-apply the same
    // guards checked above, before doing anything else.
    const chatAfterWait = await store.getChat(contactId);
    if (chatAfterWait?.state === "needs_amelia") return skip("needs_amelia");
    if (chatAfterWait?.state === "quiet" && chatAfterWait.quiet_until && Date.parse(chatAfterWait.quiet_until) > deps.now().getTime()) {
      return skip("quiet");
    }

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
    // message has none) falls back to a one-sided time comparison: only a
    // NEWER latest.at can mean a genuinely newer message arrived, so a few
    // minutes of clock skew between the webhook's `date` and SendPulse's
    // stored `created_at` can never make this fail closed and silently skip
    // an attachment (deposit screenshots — the highest-value message type).
    // Duplicate prevention no longer depends on this check being tight: the
    // dedupe claim below (`dedupeKey`) is what stops a double reply.
    const triggerText = trigger.text.trim();
    const stillLatest = triggerText
      ? latest.text.trim() === triggerText
      : Date.parse(latest.at) - Date.parse(trigger.at) <= 5 * 60_000;
    if (!stillLatest) return skip("newer message");

    // The claim for this answered message, shared by the reply path and
    // `handoff` below (one namespace, not two) — whichever of two racing
    // runs for the same member message logs first wins; the other's log
    // call returns "duplicate" and it returns early without sending
    // anything. This is what stops a member getting the same reply twice
    // with no concurrency needed (two webhooks for "hi" sent seconds apart,
    // or two photos in a row) — see store.log / store.markDelivered.
    const dedupeKey = `outcome:${contactId}:${latest.id}`;

    const after = thread.slice(lastIn + 1);
    if (after.some((m) => m.fromFlow)) return skip("flow answered");
    const ours = await store.recentAgentTexts(contactId, minus(now, ECHO_WINDOW_MS));
    if (after.some((m) => m.direction === "out" && !ours.some((o) => normaliseText(o) === normaliseText(m.text)))) {
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
      contact_id: contactId, state: "auto", quiet_until: null, is_business: contact.isBusiness,
      telegram_username: contact.username, matched_user_id: member?.userId ?? null,
      last_member_msg_at: latest.at,
    });

    const ctx = { deps, settings, contact, contactId, memberText, dedupeKey };
    if ((await store.countRepliesSince(contactId, minus(now, 3600_000))) >= MAX_REPLIES_PER_HOUR) {
      return handoff(ctx, "reply cap reached");
    }
    if ((await store.countModelCallsSince(sgtDayStart(now))) >= MAX_CALLS_PER_DAY) {
      return handoff(ctx, "daily cap reached");
    }

    const hard = mustHandOff(memberText, "other");
    if (hard) return handoff(ctx, hard);

    // Don't start the first draft this late — it can itself take up to
    // ~35s, and the route's deadline must still cover the send/handoff
    // tail behind it (see RUN_BUDGET_MS).
    const elapsedBeforeFirst = deps.now().getTime() - startedAt;
    if (RUN_BUDGET_MS - elapsedBeforeFirst < FIRST_DECIDE_MIN_BUDGET_MS) {
      return handoff(ctx, "out of time");
    }

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
    let redraftedFrom: string[] | undefined;
    if (fails.length) {
      // Don't start a redraft this late — see REDRAFT_MIN_BUDGET_MS.
      const elapsed = deps.now().getTime() - startedAt;
      if (RUN_BUDGET_MS - elapsed < REDRAFT_MIN_BUDGET_MS) {
        return handoff(ctx, "out of time", { guardFailures: fails, model: first.model, topic: d.topic });
      }
      const second = await deps.decide({ facts, thread, contact, member, retryReasons: fails, timeoutMs: REDRAFT_TIMEOUT_MS });
      const s = second.decision;
      if (!s || s.action !== "reply" || s.confidence < CONFIDENCE_MIN || checkDraft(s.reply, guardCtx).length) {
        return handoff(ctx, `guard: ${fails.join("; ")}`, { guardFailures: fails, model: first.model, topic: s?.topic ?? d.topic });
      }
      // The redraft can change topic (e.g. into a money question) — recheck
      // it exactly as the first draft's topic was checked above.
      const secondTopicHard = mustHandOff(memberText, s.topic);
      if (secondTopicHard) return handoff(ctx, secondTopicHard, { model: first.model, topic: s.topic });
      d = s;
      redraftedFrom = fails;
    }

    const text = contact.isBusiness ? PREFIX + d.reply : d.reply;
    // Claim the message immediately before sending (log before send): the
    // insert both doubles as the outcome lock (dedupeKey — see above) and
    // makes the reply visible to recentAgentTexts before SendPulse's
    // outgoing_message webhook can fire (see handleOutgoing) — without that
    // order, the agent's own send would look like Amelia replying and quiet
    // the chat for an hour after every single answer.
    const claim = await store.log({
      contact_id: contactId, kind: "reply", member_text: memberText, topic: d.topic, confidence: d.confidence,
      reply_text: text, model: first.model, latency_ms: Date.now() - started, dedupe_key: dedupeKey,
      // The first draft's guard failures, kept as a tuning signal when a
      // redraft was needed to reach a sendable reply.
      guard_failures: redraftedFrom,
    });
    if (claim.status === "duplicate") return { kind: "skip", reason: "already answered" };
    const sent = await sp.send(contactId, text);
    if (!sent) {
      // sendpulse.ts contract: `false` means "not sent OR unknown" — it may
      // already have gone out. Re-sending risks a duplicate reply to the
      // member, so this hands off instead of retrying, with no holding line
      // (the member may already have received the real answer). The row
      // just claimed is left with a null delivered_at. `alreadyClaimed`
      // tells `handoff` not to re-claim dedupeKey — this run already owns
      // it (the reply-kind row just above), so a second log() with the same
      // key would only collide with itself, not with a genuine race.
      return handoff(ctx, "send failed or unconfirmed", { sendHolding: false, model: first.model, topic: d.topic, alreadyClaimed: true });
    }
    await store.markDelivered(dedupeKey);

    await store.saveChat({ contact_id: contactId, state: "auto", quiet_until: null, last_agent_reply_at: now.toISOString() });
    return { kind: "reply" };
  } catch (e) {
    // A thrown read (getMessages/getContact/findMember/getChat/getSettings)
    // must still reach a human, not silently drop the chat. Best-effort: the
    // write helpers (setTag/setPauseAutomation/openChat) never throw, but
    // SendPulse may itself be down, so this is wrapped defensively; no
    // holding line is sent (SendPulse may be unreachable, and this must
    // never throw again).
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
    await store.log({ contact_id: contactId, kind: "error", skip_reason: reason }).catch(() => undefined);
    return { kind: "error", reason };
  }
}

async function handoff(
  ctx: { deps: RunDeps; settings: SupportSettings; contact: ContactInfo; contactId: string; memberText: string; dedupeKey: string },
  reason: string,
  opts: { sendHolding?: boolean; guardFailures?: string[]; model?: string; topic?: string; alreadyClaimed?: boolean } = {}
): Promise<RunOutcome> {
  const { deps, settings, contact, contactId, memberText, dedupeKey } = ctx;
  const sendHolding = opts.sendHolding !== false;
  const holding = `${contact.isBusiness ? PREFIX : ""}Thanks, I've passed this to Admin Amelia. She'll reply here ${settings.office_hours}.`;
  const eventFields = {
    contact_id: contactId, kind: "handoff" as const, member_text: memberText, topic: opts.topic, skip_reason: reason,
    reply_text: sendHolding ? holding : undefined, guard_failures: opts.guardFailures, model: opts.model,
  };
  if (opts.alreadyClaimed) {
    // This run already claimed dedupeKey with an earlier log() call (the
    // reply row logged just before a failed send — see run.ts) — it's not
    // racing another run, so this handoff is recorded without re-claiming
    // (a second insert with the same dedupe_key would only collide with
    // our own row).
    await deps.store.log(eventFields);
  } else {
    // Claim the same dedupeKey namespace as the reply path above — a run
    // that loses this race (whether the winner replied or also handed off)
    // returns early without sending anything. Logged BEFORE the
    // holding-line send, for the same echo-race reason as the main reply
    // above.
    const claim = await deps.store.log({ ...eventFields, dedupe_key: dedupeKey });
    if (claim.status === "duplicate") return { kind: "skip", reason: "already answered" };
  }
  let sentHolding = true;
  if (sendHolding) {
    sentHolding = await deps.sp.send(contactId, holding);
    if (sentHolding) await deps.store.markDelivered(dedupeKey);
  }
  const tagOk = await deps.sp.setTag(contactId, TAG);
  const pauseOk = await deps.sp.setPauseAutomation(contactId, HANDOFF_PAUSE_MINUTES);
  const openOk = await deps.sp.openChat(contactId);
  await deps.store.saveChat({ contact_id: contactId, state: "needs_amelia", handoff_reason: reason });
  // Member text goes through redactForModel before it reaches Telegram —
  // Telegram sits outside the 90-day support_events purge, so an email or
  // phone number pasted by a member must never linger there indefinitely.
  const pingResult = await deps.ping(
    `🙋 <b>Needs Amelia</b> · ${escapeHtml(contact.firstName || "Member")}${contact.username ? ` (@${escapeHtml(contact.username)})` : ""}` +
    `\n"${escapeHtml(redactForModel(memberText).slice(0, 300))}"\n<i>Reason: ${escapeHtml(reason)}</i>`
  );
  // setTag/setPauseAutomation/openChat/ping results used to be discarded —
  // a fully failed handoff left only a support_chats row nobody watches.
  // Record which writes failed (if any) on the event just logged, so a
  // silently-undelivered ping (or tag/pause/openChat) is visible.
  const failed = [
    !tagOk && "setTag", !pauseOk && "setPauseAutomation", !openOk && "openChat", !pingResult.ok && "ping",
  ].filter((x): x is string => Boolean(x));
  if (failed.length) {
    await deps.store.patchSkipReason(dedupeKey, `${reason} (write failed: ${failed.join(", ")})`);
  }
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
    // Scan every outgoing message since the member's last one, not just the
    // newest — otherwise the sequence [Amelia reply, agent reply] never
    // sets a quiet period: the newest (the agent's own echo) matches `ours`
    // and short-circuits before Amelia's earlier reply is ever looked at.
    const lastIn = thread.map((m) => m.direction).lastIndexOf("in");
    const after = thread.slice(lastIn + 1).filter((m) => m.direction === "out");
    if (!after.length) return "ignored";
    const ours = await deps.store.recentAgentTexts(contactId, minus(deps.now(), ECHO_WINDOW_MS));
    const personReply = after.find((m) => !m.fromFlow && !ours.some((o) => normaliseText(o) === normaliseText(m.text)));
    if (!personReply) return "ignored";
    const chat = await deps.store.getChat(contactId);
    if (chat?.state !== "needs_amelia") {
      await deps.store.saveChat({ contact_id: contactId, state: "quiet", quiet_until: plus(deps.now(), QUIET_MINUTES * 60_000) });
    }
    await deps.store.log({ contact_id: contactId, kind: "amelia_reply", reply_text: personReply.text });
    return "amelia_reply";
  } catch (e) {
    // Must never throw out of the webhook route's after() callback.
    await deps.store.log({ contact_id: contactId, kind: "error", skip_reason: e instanceof Error ? e.message : String(e) }).catch(() => undefined);
    return "ignored";
  }
}
