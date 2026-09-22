import "server-only";
import { adminDb } from "@/lib/channel/db";
import { sendTelegram, escapeHtml } from "@/lib/telegram";
import * as sendpulse from "./sendpulse";
import { decide as realDecide, redactForModel } from "./agent";
import { buildFactSheet } from "./facts";
import { checkDraft, mustHandOff } from "./guard";
import { toTelegramHtml } from "./format";
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
// SendPulse rejects anything over 120 (verified: minutes:1440 returns 422
// "The minutes may not be greater than 120"), which silently left handed-off
// chats unpaused. 120 is the cap. This only pauses SENDPULSE's own flows; what
// actually keeps the agent out of the chat is support_chats.state =
// needs_amelia, which holds until an admin clears it in /admin/support.
export const HANDOFF_PAUSE_MINUTES = 120;
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
 * writes plus a Telegram ping, each up to 10s).
 *
 * Honest worst case, taking the gates at their limits: the first draft may
 * start with FIRST_DECIDE_MIN_BUDGET_MS remaining, i.e. at 55s elapsed, and
 * run 35s (90s); a redraft may then run REDRAFT_TIMEOUT_MS (110s); the
 * handoff tail behind it is up to HANDOFF_TAIL_MS (160s). That fits the
 * route's 180s ceiling but NOT the platform default of 120s — which is why
 * the route sets maxDuration explicitly. ROUTE_MAX_DURATION_MS below is the
 * tripwire: raise any constant past what the route allows and a test fails.
 */
export const RUN_BUDGET_MS = 100_000;
/** The send/handoff tail after the last model call: a holding-line send plus
 * setTag, setPauseAutomation, openChat and a Telegram ping. sendpulse.ts
 * allows each write 10s, and a 401 or 429 retry can stretch one further. */
export const HANDOFF_TAIL_MS = 50_000;
/** Must match `maxDuration` in src/app/api/support/webhook/route.ts. */
export const ROUTE_MAX_DURATION_MS = 180_000;
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
/** Re-check for a chat state change that happened WHILE this run was
 * drafting, redrafting, or waiting on a cap/budget check — a model call can
 * take up to ~35s (see RUN_BUDGET_MS), plenty of time for Amelia to answer
 * and for `handleOutgoing` to set `quiet`/`needs_amelia`. This re-applies
 * the same two guards checked at the top of `runBurst`, right before the
 * claim that's about to send something — the only guarantee that matters,
 * since everything upstream of the claim can go stale. Returns the skip
 * reason, or null when it's still safe to proceed. */
/** The start of an echo window measured from a message's OWN timestamp.
 * sendpulse.ts maps a missing/non-string created_at to "", and
 * `new Date("")` is an Invalid Date whose toISOString() throws — which would
 * lose Amelia's quiet period (handleOutgoing catches, returns "ignored", and
 * the agent then replies over her). Fall back to the run clock instead. */
function windowFrom(iso: string, fallback: Date): string {
  const t = Date.parse(iso);
  return minus(Number.isNaN(t) ? fallback : new Date(t), ECHO_WINDOW_MS);
}

async function chatChangedDuringRun(store: SupportStore, contactId: string, now: Date): Promise<string | null> {
  const chat = await store.getChat(contactId);
  if (chat?.state === "needs_amelia") return "needs_amelia";
  if (chat?.state === "quiet" && chat.quiet_until && Date.parse(chat.quiet_until) > now.getTime()) return "quiet";
  return null;
}
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
  depsArg?: RunDeps
): Promise<RunOutcome> {
  // `defaultDeps()` calls `adminDb()`, which can throw (missing/misconfigured
  // env vars). As a default *parameter* expression that throw would happen
  // outside this function's own try/catch, rejecting straight out of the
  // caller (the webhook route's `after()`, which nothing else guards) — so
  // it's constructed here instead, inside a try of its own (item 8).
  let deps: RunDeps;
  try {
    deps = depsArg ?? defaultDeps();
  } catch (e) {
    return { kind: "error", reason: e instanceof Error ? e.message : String(e) };
  }
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

    // A STALE READ is the only case where a lost claim means nobody answered
    // this message: the thread read still shows an older, already-answered
    // message, so the trigger is meaningfully NEWER than the thread's latest.
    // An ordinary burst (two photos, "hi" twice) is the opposite — both runs
    // resolve `latest` to the SAME newest message, and the winner's
    // memberText already aggregates the consecutive incoming messages, so the
    // loser must skip silently rather than escalate to Amelia.
    const latestMs = Date.parse(latest.at);
    const triggerMs = Date.parse(trigger.at);
    const staleRead = Number.isFinite(latestMs) && Number.isFinite(triggerMs) && triggerMs - latestMs > 30_000;

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
    // Each outgoing message is judged against a window anchored on its OWN
    // timestamp, not the run clock and not the first message's (item 3) — a
    // late-arriving webhook for the agent's own send must still find that
    // send in the window, and anchoring the whole set off the oldest message
    // would widen the window in the lenient direction.
    for (const m of after) {
      if (m.direction !== "out") continue;
      const ours = await store.recentAgentTexts(contactId, windowFrom(m.at, now));
      if (!ours.some((o) => normaliseText(o) === normaliseText(m.text))) {
        await store.saveChat({ contact_id: contactId, state: "quiet", quiet_until: plus(now, QUIET_MINUTES * 60_000) });
        return skip("answered by a person");
      }
    }

    let start = lastIn;
    while (start > 0 && thread[start - 1].direction === "in") start--;
    const memberText = thread.slice(start, lastIn + 1).map((m) => m.text).filter(Boolean).join("\n");
    const memberTexts = thread.filter((m) => m.direction === "in").map((m) => m.text);

    const contact: ContactInfo = (await sp.getContact(contactId))
      ?? { id: contactId, username: null, firstName: "", isBusiness: false, tags: [] };
    // Belt and braces (item 2): SendPulse's own tag backstops a lost
    // support_chats row — if a previous handoff's saveChat failed to
    // persist but its setTag call still landed, the tag alone must still
    // keep the agent from replying over Amelia.
    if (contact.tags.includes(TAG)) return skip("needs_amelia (tag)");
    const member = await deps.findMember({ texts: memberTexts, telegramUsername: contact.username });
    // `state`/`quiet_until` are deliberately NOT written here (item 1) —
    // `handleOutgoing` and `handoff` are the only writers of chat state. This
    // call exists only to persist bookkeeping fields alongside whatever
    // state a concurrent write (Amelia's reply, a handoff) may have set.
    // Bookkeeping only: a failure here must never escalate an otherwise
    // healthy run into the catch block below (which would tag the chat,
    // pause automation for 24h and ping Amelia over a cosmetic field).
    await store.saveChat({
      contact_id: contactId, is_business: contact.isBusiness,
      telegram_username: contact.username, matched_user_id: member?.userId ?? null,
      last_member_msg_at: latest.at,
    }).catch(() => undefined);

    const ctx = { deps, settings, contact, contactId, memberText, dedupeKey, staleRead };
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

    // Convert once, then log and send the SAME string: handleOutgoing matches
    // the agent's own echo against what was logged, so they must be identical.
    const text = toTelegramHtml(contact.isBusiness ? PREFIX + d.reply : d.reply);
    // Amelia could have taken the chat while the model was drafting or
    // redrafting above (item 1) — re-check right before the claim, the last
    // possible moment before anything is sent.
    const changedReason = await chatChangedDuringRun(store, contactId, deps.now());
    if (changedReason) return skip(changedReason);
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
    if (claim.status === "duplicate") {
      if (ctx.staleRead) {
        // Only a stale read (the thread still showing an older,
        // already-answered message) means THIS message — often a deposit
        // screenshot — was never actually handled by the run that won the
        // key. Escalate under a distinct key so a human sees it. An ordinary
        // burst is NOT this case: both runs resolve to the same newest
        // message and the winner's answer covered it, so the loser skips.
        return handoff({ ...ctx, dedupeKey: `${dedupeKey}:stale-dup`, staleRead: false }, "duplicate claim (stale read)");
      }
      return { kind: "skip", reason: "already answered" };
    }
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

    // `state`/`quiet_until` are deliberately NOT written here either (item
    // 1) — see the earlier saveChat call above.
    // Bookkeeping only, and the member already has the message — a failure
    // here must not turn a delivered reply into an error outcome.
    await store.saveChat({ contact_id: contactId, last_agent_reply_at: now.toISOString() }).catch(() => undefined);
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
      // Ping BEFORE the state write: saveChat throws on a failed upsert, and
      // that failure is correlated with whatever put us in this catch (a
      // database outage breaks the read AND the write). Alerting a human is
      // the whole point of this path, so it must not depend on the write.
      await deps.ping(`⚠️ <b>Support agent error</b> · contact ${escapeHtml(contactId)}\n<i>${escapeHtml(reason)}</i>`);
      await store.saveChat({ contact_id: contactId, state: "needs_amelia", handoff_reason: reason }).catch(() => undefined);
    } catch {
      // Best-effort only — the error event below is logged either way.
    }
    await store.log({ contact_id: contactId, kind: "error", skip_reason: reason }).catch(() => undefined);
    return { kind: "error", reason };
  }
}

async function handoff(
  ctx: { deps: RunDeps; settings: SupportSettings; contact: ContactInfo; contactId: string; memberText: string; dedupeKey: string; staleRead: boolean },
  reason: string,
  opts: { sendHolding?: boolean; guardFailures?: string[]; model?: string; topic?: string; alreadyClaimed?: boolean } = {}
): Promise<RunOutcome> {
  const { deps, settings, contact, contactId, memberText, dedupeKey, staleRead } = ctx;
  // Derived, not trusted from the caller (item 5): a run that doesn't hold a
  // fresh claim on `dedupeKey` (alreadyClaimed) must never also notify the
  // member as if it did — the earlier claim's own outcome (a sent reply, or
  // another run's handoff) already governs what the member sees.
  const sendHolding = opts.sendHolding !== false && !opts.alreadyClaimed;
  const holding = toTelegramHtml(`${contact.isBusiness ? PREFIX : ""}Thanks, I've passed this to Admin Amelia. She'll reply here ${settings.office_hours}.`);
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
    // Amelia could have taken the chat while this run was drafting,
    // redrafting, or waiting on a cap/budget check (item 1) — re-check
    // immediately before claiming.
    const changedReason = await chatChangedDuringRun(deps.store, contactId, deps.now());
    if (changedReason) {
      // Logged, not silent: "every outcome logged exactly once" holds for
      // this path too, so an aborted handoff is visible in the activity log.
      await deps.store.log({ contact_id: contactId, kind: "skip", skip_reason: changedReason }).catch(() => undefined);
      return { kind: "skip", reason: changedReason };
    }
    // Claim the same dedupeKey namespace as the reply path above — a run
    // that loses this race (whether the winner replied or also handed off)
    // returns early without sending anything. Logged BEFORE the
    // holding-line send, for the same echo-race reason as the main reply
    // above.
    const claim = await deps.store.log({ ...eventFields, dedupe_key: dedupeKey });
    if (claim.status === "duplicate") {
      if (staleRead) {
        // Only a stale read proves this message went unanswered by the run
        // that won the key (see runBurst's `staleRead`). `staleRead: false`
        // bounds this to a single retry even if the escalation key itself
        // somehow collides.
        return handoff({ ...ctx, dedupeKey: `${dedupeKey}:stale-dup`, staleRead: false }, `${reason} (duplicate claim, stale read)`);
      }
      return { kind: "skip", reason: "already answered" };
    }
  }
  let sentHolding = true;
  if (sendHolding) {
    sentHolding = await deps.sp.send(contactId, holding);
    if (sentHolding) await deps.store.markDelivered(dedupeKey);
  }
  const tagOk = await deps.sp.setTag(contactId, TAG);
  const pauseOk = await deps.sp.setPauseAutomation(contactId, HANDOFF_PAUSE_MINUTES);
  const openOk = await deps.sp.openChat(contactId);
  // saveChat can now throw on a failed write (store.ts, item 2) — this is
  // the write that actually puts the chat in needs_amelia, so a failure here
  // must be recorded on the event below rather than aborting the rest of the
  // handoff (the tag/pause/ping side effects should still be attempted).
  let chatSaved = true;
  try {
    await deps.store.saveChat({ contact_id: contactId, state: "needs_amelia", handoff_reason: reason });
  } catch {
    chatSaved = false;
  }
  // Member text goes through redactForModel before it reaches Telegram —
  // Telegram sits outside the 90-day support_events purge, so an email or
  // phone number pasted by a member must never linger there indefinitely.
  const pingResult = await deps.ping(
    `🙋 <b>Needs Amelia</b> · ${escapeHtml(contact.firstName || "Member")}${contact.username ? ` (@${escapeHtml(contact.username)})` : ""}` +
    `\n"${escapeHtml(redactForModel(memberText).slice(0, 300))}"\n<i>Reason: ${escapeHtml(reason)}</i>`
  );
  // setTag/setPauseAutomation/openChat/ping/saveChat results used to be
  // discarded — a fully failed handoff left only a support_chats row nobody
  // watches (or, for saveChat, no row at all — item 2). Record which writes
  // failed (if any) on the event just logged, so a silently-undelivered
  // holding line, tag/pause/openChat, chat-state save, or ping is visible.
  const failed = [
    sendHolding && !sentHolding && "send", !tagOk && "setTag", !pauseOk && "setPauseAutomation", !openOk && "openChat",
    !chatSaved && "saveChat", !pingResult.ok && "ping",
  ].filter((x): x is string => Boolean(x));
  if (failed.length) {
    await deps.store.patchSkipReason(dedupeKey, `${reason} (write failed: ${failed.join(", ")})`);
  }
  return { kind: "handoff", reason };
}

/** An outgoing message the agent didn't send: a person replied, so go quiet. */
export async function handleOutgoing(contactId: string, depsArg?: RunDeps): Promise<"amelia_reply" | "ignored"> {
  // See runBurst's identical guard (item 8) — defaultDeps() can throw, and
  // that must not reject out of the webhook route's after() callback either.
  // There's no store to log to yet, so this can only report "ignored".
  let deps: RunDeps;
  try {
    deps = depsArg ?? defaultDeps();
  } catch {
    return "ignored";
  }
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
    const after = thread.slice(lastIn + 1).filter((m) => m.direction === "out" && !m.fromFlow);
    if (!after.length) return "ignored";
    // Scan newest-first, each candidate's echo window judged against its OWN
    // timestamp (item 3) rather than the run clock — a reply logged well
    // before this webhook fired (backlog/retry) is still recognised as ours
    // even when the webhook itself arrives late. Stopping at the first
    // (newest) genuine non-echo message also means a later, unrelated
    // webhook never re-flags an older message that was already handled
    // (item 6) — see the claim below for the belt-and-braces on retries.
    let personReply: ThreadMessage | undefined;
    for (let i = after.length - 1; i >= 0; i--) {
      const m = after[i];
      const ours = await deps.store.recentAgentTexts(contactId, windowFrom(m.at, deps.now()));
      if (!ours.some((o) => normaliseText(o) === normaliseText(m.text))) {
        personReply = m;
        break;
      }
    }
    if (!personReply) return "ignored";
    // Claim this specific message before acting on it (item 6): a
    // retried/duplicate webhook for the SAME reply must not re-log the event
    // or re-extend the quiet period every time it arrives.
    const claim = await deps.store.log({
      contact_id: contactId, kind: "amelia_reply", reply_text: personReply.text,
      dedupe_key: `amelia:${contactId}:${personReply.id}`,
    });
    if (claim.status === "duplicate") return "ignored";
    const chat = await deps.store.getChat(contactId);
    if (chat?.state !== "needs_amelia") {
      try {
        await deps.store.saveChat({ contact_id: contactId, state: "quiet", quiet_until: plus(deps.now(), QUIET_MINUTES * 60_000) });
      } catch {
        // The claim above is already spent, so SendPulse's retry of this same
        // reply would return "duplicate" and never set quiet — the period
        // would be lost permanently. Fail closed instead: SendPulse's own tag
        // keeps the agent out of the chat, and a human is told.
        await deps.sp.setTag(contactId, TAG);
        await deps.ping(`🙋 <b>Needs Amelia</b> · quiet period could not be saved for contact ${escapeHtml(contactId)}`);
      }
    }
    return "amelia_reply";
  } catch (e) {
    // Must never throw out of the webhook route's after() callback.
    await deps.store.log({ contact_id: contactId, kind: "error", skip_reason: e instanceof Error ? e.message : String(e) }).catch(() => undefined);
    return "ignored";
  }
}
