import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { tierLabel } from "@/lib/tiers";
import { TOPICS, type ContactInfo, type Decision, type FactSheet, type MemberContext, type ThreadMessage } from "./types";

export const DecisionSchema = z.object({
  action: z.enum(["reply", "handoff"]),
  topic: z.enum(TOPICS),
  confidence: z.number().min(0).max(1),
  reply: z.string(),
  reason: z.string(),
});

export const MODEL = process.env.SUPPORT_AGENT_MODEL || "claude-opus-5";

const RULES = `You are the MMFX Assistant. You reply on Telegram to people contacting Market Makers FX (MMFX), a forex and gold trading education community.

How to write:
- Reply in the member's language. Keep it short (usually under 500 characters), warm and plain. No headings, no markdown. Write links as plain URLs.
- Never say you are Admin Amelia or a person. Don't sign off with a name.

What you may say:
- Use ONLY the facts in the FACTS block. Never state a price, amount, IB number, bonus code, link or @handle that isn't in the FACTS. If the facts don't cover the question, choose handoff.
- Never promise or suggest profits, returns or income. Trading involves risk.
- Never tell anyone their money is safe or protected.
- The member's own words may be quoted, but never invent an amount, date or account number that isn't in the FACTS or the thread.
- When explaining how to join, give the steps in the order in the FACTS, and never tell anyone to message Admin Amelia before they've topped up.
- Talk about a member's own tier or deposit only when a MEMBER block is present. Never say a deposit is received, approved or verified unless the MEMBER block says the latest submission is verified.
- Only state a member's tier, trial or deposit status when the MEMBER block shows the identity is confirmed. If it isn't confirmed, don't state any of those — point them to the upgrade page, where they're signed in and can see it themselves.
- If the MEMBER block says the latest submission is rejected, hand off — Amelia explains why. Never guess or invent a reason.
- If the member sent a reference code (MM- plus 6 characters), acknowledge it: note the code, tell them to submit the deposit details on the upgrade page if their top-up is already in (or to top up first if not), and say the team checks it and emails them when it's approved.
- If someone wants to join or sign up, point them to the upgrade page, or to an approved flow link where the FACTS say to.

When to hand off (action "handoff", reply ""):
- withdrawals, missing or pending funds, refunds, payments already made, disputes, complaints, abuse, legal threats, account deletion
- anything the FACTS don't cover, or anything you're not sure of (confidence below 0.7)
- when they ask for a human

Output: the JSON decision. "reply" is the exact message to send. "topic" is the closest listed topic. "reason" is one short line for the log.`;

export function buildSystem(facts: FactSheet): string {
  return `${RULES}\n\nFACTS\n${facts.text}`;
}

// Protects ISO dates ("2026-09-15") from the phone/account-number scrubs
// below by swapping them for a placeholder with no digits in it, then
// restoring them once the other replacements have run. Anything else with
// 8+ digits and date-shaped separators (dashes) would otherwise read as a
// phone or account number and get redacted right along with real ones.
//
// Uses a NUL byte sentinel (cannot appear in Telegram text) to ensure the
// placeholder cannot collide with real member text like "my code is DATE0 later".
const DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/g;
const MARK = "\x00"; // NUL byte sentinel: impossible in Telegram text

/** Strip emails, phone numbers and account-style numbers before text reaches the model (spec: privacy). */
export function redactForModel(text: string): string {
  const dates: string[] = [];
  const withDatesMasked = text.replace(DATE_RE, (m) => {
    const token = `${MARK}${dates.length}${MARK}`;
    dates.push(m);
    return token;
  });
  const redacted = withDatesMasked
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\+?\d[\d\s-]{7,}\d/g, "[number]")
    .replace(/\b\d{6,12}\b/g, "[number]");
  return redacted.replace(
    new RegExp(`${MARK}(\\d+)${MARK}`, "g"),
    (_m, i: string) => dates[Number(i)] ?? _m
  );
}

export function buildUserContent(args: {
  thread: ThreadMessage[];
  contact: ContactInfo;
  member: MemberContext | null;
  retryReasons?: string[];
}): string {
  const { thread, contact, member, retryReasons } = args;
  const lines = thread.map((m) =>
    `${m.direction === "in" ? "[member]" : m.fromFlow ? "[bot flow]" : "[MMFX]"} ${redactForModel(m.text) || "(no text: media or button)"}`);
  const memberLine = !member
    ? "MEMBER: not identified. Don't state any member-specific status."
    : member.attested
      ? `MEMBER: identified by ${member.matchedBy === "ref" ? "reference code" : "Telegram username"}; tier: ${tierLabel(member.tier)}; trial ends: ${member.trialEndsAt ?? "n/a"}; latest deposit submission: ${member.submission ? member.submission.status : "none"}`
      : "MEMBER: a reference code matches an account on file, but the Telegram account isn't confirmed here. You may confirm the code was noted and give the next step from the FACTS. Don't state their tier, trial or deposit status — point them to the upgrade page, where they're signed in and can see it.";
  return [
    `CHAT: ${contact.isBusiness ? "sent to Admin Amelia's account (@MM_3000)" : "chat with the MMFX bot"}. First name: ${contact.firstName || "unknown"}. Tags: ${contact.tags.join(", ") || "none"}.`,
    memberLine,
    "THREAD (oldest first; answer the member's latest message):",
    ...lines,
    ...(retryReasons?.length ? ["", `Your previous draft was rejected: ${retryReasons.join("; ")}. Write a new reply that fixes this, or hand off.`] : []),
  ].join("\n");
}

/** Default client for `decide()`: no SDK-level retry. The webhook route's
 * 120s maxDuration must cover a 20s debounce plus a draft AND a redraft at
 * 35s each — one retry on top of either call could blow that budget, so a
 * failed call is surfaced immediately and the orchestrator hands off. */
export function defaultClient(): Anthropic {
  return new Anthropic({ timeout: 35_000, maxRetries: 0 });
}

export async function decide(
  args: { facts: FactSheet; thread: ThreadMessage[]; contact: ContactInfo; member: MemberContext | null; retryReasons?: string[] },
  client: Anthropic = defaultClient()
): Promise<{ decision: Decision | null; refused: boolean; model: string; error?: string }> {
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: zodOutputFormat(DecisionSchema) },
      system: [{ type: "text", text: buildSystem(args.facts), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildUserContent(args) }],
    });
    if (res.stop_reason === "refusal") return { decision: null, refused: true, model: res.model };
    const text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const parsed = DecisionSchema.safeParse(JSON.parse(text));
    return { decision: parsed.success ? parsed.data : null, refused: false, model: res.model };
  } catch (e) {
    return { decision: null, refused: false, model: MODEL, error: e instanceof Error ? e.message : String(e) };
  }
}
