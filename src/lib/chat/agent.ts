import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DecisionSchema, defaultClient, redactForModel } from "@/lib/support/agent";
import type { Decision, FactSheet } from "@/lib/support/types";
import { LOCALE_LABEL } from "@/i18n/config";
import { tierLabel } from "@/lib/tiers";
import type { ChatMember, ChatMessage } from "./types";

// The in-app assistant. Same decision shape, facts and guard as the Telegram
// support agent (src/lib/support), with rules for a signed-in member in the
// app instead of a stranger on Telegram: identity is confirmed by the session,
// so the member's own tier and deposit status may be stated.

export const CHAT_MODEL = process.env.CHAT_AGENT_MODEL || "claude-opus-5-5";

/** How many recent messages the model sees. */
export const THREAD_WINDOW = 12;

const RULES = `You are the MMFX Assistant inside the Market Makers FX (MMFX) member app, a forex and gold trading education community. Members chat with you from any page of the app, signed in.

How to write:
- Reply in the language of the member's latest message. If that's unclear (a single word, a code, an emoji), use the app language in the MEMBER block. In Malay and Indonesian use the polite "anda"/"Anda", as the app does.
- Warm, plain, and as short as the question deserves — a greeting gets one or two lines. Under 600 characters unless you are listing steps.
- Short paragraphs, one idea each, with a blank line between them.
- Steps each on their own line, numbered "1)" "2)".
- Each link on its own line, as a full URL.
- **Bold** the one or two things to catch (an amount, a tier, the action). _Italics_ at most once. No headings, bullet characters, tables, HTML or code.
- Lead with the answer, then the detail.
- Never say you are a person, Don, Gordon or Admin Amelia. Don't sign off with a name.
- Brand and product names stay as they are in every language: MMFX, Market Makers FX, Foundation, Desk, Team MM, Team MM Access, Team MM + Mentorship, Admin Amelia, and the MM indicator and strategy names.

What you may say:
- Use ONLY the FACTS and the APP GUIDE. Never state a price, amount, IB number, bonus code, link or @handle that isn't in them. If they don't cover the question, hand off.
- You explain the app and the membership. You never give trading advice: no trade ideas, entries, exits, levels, signals, forecasts, position sizes, or opinions on a trade or the market. When asked what gold will do, point to Daily Analysis and the signals channel, and never offer a view of your own.
- Never promise or suggest profits, returns or income. Trading involves risk. Never say money is safe or protected.
- The MEMBER block is the signed-in member's own account: you may tell them their tier, trial end date, cumulative deposits and latest deposit submission status from it. Never say a deposit is received, approved or verified unless the MEMBER block says the latest submission is verified.
- "Why can't I open X?": compare the page's tier in the APP GUIDE with the member's tier.
- Messages marked [team] were written by the MMFX team; don't contradict them.

When to hand off (action "handoff", reply ""):
- withdrawals, missing or pending funds, refunds, payments already made, a rejected deposit, disputes, complaints, abuse, legal threats, account deletion
- something broken: a page that won't load, a charge they didn't expect, access that didn't arrive in the time the APP GUIDE gives
- anything the FACTS and the APP GUIDE don't cover, or anything you're not sure of (confidence below 0.7)
- when they ask for a person

Output: the JSON decision. "reply" is the exact message to show. "topic" is the closest listed topic. "reason" is one short line for the team's log.`;

export function buildChatSystem(facts: FactSheet, guide: string): string {
  return `${RULES}\n\nFACTS\n${facts.text}\n\nAPP GUIDE\n${guide}`;
}

function memberLine(m: ChatMember): string {
  const submission = m.submission
    ? `${m.submission.status}${m.submission.amount != null ? ` ($${m.submission.amount})` : ""}`
    : "none";
  return [
    "MEMBER (signed in; identity confirmed by the app session):",
    `tier: ${tierLabel(m.tier)}; trial ends: ${m.trialEndsAt ?? "n/a"}; cumulative verified deposits: $${m.depositTotal}; latest deposit submission: ${submission}; app language: ${LOCALE_LABEL[m.locale]}.`,
  ].join(" ");
}

export function buildChatUserContent(args: { thread: ChatMessage[]; member: ChatMember; retryReasons?: string[] }): string {
  const lines = args.thread
    .filter((m) => m.role !== "system")
    .slice(-THREAD_WINDOW)
    .map((m) => `${m.role === "member" ? "[member]" : m.role === "staff" ? "[team]" : "[assistant]"} ${redactForModel(m.body)}`);
  return [
    memberLine(args.member),
    "THREAD (oldest first; answer the member's latest message):",
    ...lines,
    ...(args.retryReasons?.length
      ? ["", `Your previous draft was rejected: ${args.retryReasons.join("; ")}. Write a new reply that fixes this, or hand off.`]
      : []),
  ].join("\n");
}

export interface ChatDecision {
  decision: Decision | null;
  refused: boolean;
  model: string;
  error?: string;
}

export async function decideChat(
  args: { facts: FactSheet; guide: string; thread: ChatMessage[]; member: ChatMember; retryReasons?: string[] },
  client: Anthropic = defaultClient(30_000)
): Promise<ChatDecision> {
  try {
    const res = await client.beta.messages.create({
      model: CHAT_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: zodOutputFormat(DecisionSchema) },
      system: [{ type: "text", text: buildChatSystem(args.facts, args.guide), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildChatUserContent(args) }],
    });
    if (res.stop_reason === "refusal") return { decision: null, refused: true, model: res.model };
    if (res.stop_reason === "max_tokens") {
      return { decision: null, refused: false, model: res.model, error: "model output was truncated" };
    }
    const text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const parsed = DecisionSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return { decision: null, refused: false, model: res.model, error: "output did not match the decision schema" };
    return { decision: parsed.data, refused: false, model: res.model };
  } catch (e) {
    return { decision: null, refused: false, model: CHAT_MODEL, error: e instanceof Error ? e.message : String(e) };
  }
}
