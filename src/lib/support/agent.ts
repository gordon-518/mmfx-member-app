import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { tierLabel } from "@/lib/tiers";
import { TOPICS, type ContactInfo, type Decision, type FactSheet, type MemberContext, type ThreadMessage } from "./types";

export const DecisionSchema = z
  .object({
    action: z.enum(["reply", "handoff"]),
    topic: z.enum(TOPICS),
    confidence: z.number().min(0).max(1),
    reply: z.string(),
    reason: z.string(),
  })
  // A "reply" decision with a blank (or whitespace-only) reply would have
  // the orchestrator send an empty Telegram message. "handoff" keeps
  // reply: "" as valid — it's never sent.
  .superRefine((data, ctx) => {
    if (data.action === "reply" && data.reply.trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "reply must not be blank when action is \"reply\"", path: ["reply"] });
    }
  });

export const MODEL = process.env.SUPPORT_AGENT_MODEL || "claude-opus-5";

const RULES = `You are the MMFX Assistant. You reply on Telegram to people contacting Market Makers FX (MMFX), a forex and gold trading education community.

How to write:
- Reply in the member's language. Warm, plain, and as short as the question deserves — a greeting gets one or two lines, not a pitch. Under 500 characters unless you are genuinely listing steps.
- SHAPE THE MESSAGE so it can be read on a phone at a glance:
  - Short paragraphs, one idea each, with a blank line between them. Never one long block.
  - When you give steps, put each on its own line, numbered "1)" "2)" — never run them together in a sentence.
  - Put each link on its own line, as a plain URL.
  - **Bold** the things the member needs to catch: amounts, tier names, the one action you want them to take. Use it 2-4 times at most; bold everywhere reads like shouting.
  - _Italics_ only for a light aside, at most once.
  - The only markers you may use are **bold** and _italics_. No headings, no bullet characters, no tables, no HTML tags, no code blocks.
- Lead with the answer, then the detail. The first line should answer the question on its own.
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
- A member who sends a reference code (MM- plus 6 characters) has already submitted their deposit on the upgrade page — that is where the code comes from. Just say you've noted it and that the team checks it and emails them; never say it was received, confirmed, verified or approved, and never ask them to submit again. If they haven't topped up or submitted yet, give the steps from the FACTS in order.
- Someone new starts at the signup page, not the upgrade page: the upgrade page redirects to login unless they already have an account. Send the signup link first (it's free and starts the trial), then the rest of the steps. Only send the upgrade page on its own when they've said they already have an account.

When to hand off (action "handoff", reply ""):
- withdrawals, missing or pending funds, refunds, payments already made, disputes, complaints, abuse, legal threats, account deletion
- anything the FACTS don't cover, or anything you're not sure of (confidence below 0.7)
- when they ask for a human

Output: the JSON decision. "reply" is the exact message to send. "topic" is the closest listed topic. "reason" is one short line for the log.`;

export function buildSystem(facts: FactSheet): string {
  return `${RULES}\n\nFACTS\n${facts.text}`;
}

// Protects ISO dates ("2026-09-15") and MM- reference codes ("MM-123456")
// from the phone/account-number scrubs below by swapping each for a
// placeholder with no digits in it, then restoring them once the other
// replacements have run. A deposit reference code is "MM-" plus 6 hex
// chars — about 6% are all-digit ("MM-123456") and would otherwise read as
// an account number and get redacted right along with real ones. Likewise
// anything else with 8+ digits and date-shaped separators (dashes) would
// read as a phone or account number.
//
// Uses a NUL byte sentinel. Real Telegram text can't contain one, and
// redactForModel strips any NUL from the input before masking anything
// (see below), so the placeholder truly cannot collide with member text —
// by construction, not by luck.
const DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/g;
const REF_CODE_RE = /\bMM-[0-9a-f]{6}\b/gi;
const MARK = "\x00"; // NUL byte sentinel: stripped from all input below, so it can never appear in member text

/** Masks every match of `re` in `text` with a `${MARK}<index>${MARK}` token, recording the original at that index in `store`. */
function maskWithSentinel(text: string, re: RegExp, store: string[]): string {
  return text.replace(re, (m) => {
    const token = `${MARK}${store.length}${MARK}`;
    store.push(m);
    return token;
  });
}

/** Strip emails, phone numbers and account-style numbers before text reaches the model (spec: privacy). */
export function redactForModel(text: string): string {
  // A NUL byte cannot occur in real Telegram text; stripping it here makes
  // the sentinel above impossible — not just unlikely — to collide with
  // member text.
  const clean = text.replace(/\x00/g, "");
  const saved: string[] = [];
  const masked = maskWithSentinel(maskWithSentinel(clean, DATE_RE, saved), REF_CODE_RE, saved);
  const redacted = masked
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\+?\d[\d\s-]{7,}\d/g, "[number]")
    .replace(/\b\d{6,12}\b/g, "[number]");
  return redacted.replace(
    new RegExp(`${MARK}(\\d+)${MARK}`, "g"),
    (_m, i: string) => saved[Number(i)] ?? _m
  );
}

/**
 * Contact tags, with contradictions removed.
 *
 * Tags accumulate: a member who retakes the questionnaire, or who was tagged
 * in an old campaign, ends up with several country_*, exp_* or capital_* tags
 * at once (one live contact carried five different countries). Passing those
 * through invites the model to pick one and quote, say, the US/UK lifetime
 * plans to someone in Malaysia. Where a group conflicts, the answer is that we
 * do not know — the upgrade page detects the country properly.
 */
export function describeTags(tags: string[]): string {
  const groups = ["country", "exp", "capital"];
  const kept: string[] = [];
  const unknown: string[] = [];
  for (const g of groups) {
    const hits = tags.filter((t) => t.toLowerCase().startsWith(`${g}_`));
    if (hits.length === 1) kept.push(hits[0]);
    else if (hits.length > 1) unknown.push(g === "exp" ? "experience" : g);
  }
  const rest = tags.filter((t) => !groups.some((g) => t.toLowerCase().startsWith(`${g}_`)));
  const parts = [...kept, ...rest];
  const line = parts.length ? parts.join(", ") : "none";
  return unknown.length
    ? `${line} (conflicting ${unknown.join(" and ")} tags, so treat those as UNKNOWN — don't infer a country from them)`
    : line;
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
      : "MEMBER: a reference code was mentioned, but the Telegram account sending this isn't confirmed here. You may say the code was noted, but never say whether it matched anything. Don't state their tier, trial or deposit status — point them to the upgrade page, where they're signed in and can see it.";
  return [
    `CHAT: ${contact.isBusiness ? "sent to Admin Amelia's account (@MM_3000)" : "chat with the MMFX bot"}. First name: ${contact.firstName || "unknown"}. Tags: ${describeTags(contact.tags)}.`,
    memberLine,
    "THREAD (oldest first; answer the member's latest message):",
    ...lines,
    ...(retryReasons?.length ? ["", `Your previous draft was rejected: ${retryReasons.join("; ")}. Write a new reply that fixes this, or hand off.`] : []),
  ].join("\n");
}

/** Default client for `decide()`: no SDK-level retry. The webhook route's
 * maxDuration must cover a 20s debounce plus a draft AND a possible redraft
 * — one retry on top of either call could blow that budget, so a failed
 * call is surfaced immediately and the orchestrator hands off. `timeoutMs`
 * lets a later, more time-pressed call (run.ts's redraft) use a shorter
 * client timeout than the first draft's default. */
export function defaultClient(timeoutMs = 35_000): Anthropic {
  return new Anthropic({ timeout: timeoutMs, maxRetries: 0 });
}

export async function decide(
  args: {
    facts: FactSheet; thread: ThreadMessage[]; contact: ContactInfo; member: MemberContext | null;
    retryReasons?: string[];
    /** Client-side timeout for this call, when no explicit `client` is passed. Defaults to 35s (defaultClient's own default). */
    timeoutMs?: number;
  },
  client: Anthropic = defaultClient(args.timeoutMs)
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
    if (res.stop_reason === "max_tokens") {
      return { decision: null, refused: false, model: res.model, error: "model output was truncated" };
    }
    const text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const parsed = DecisionSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      return { decision: null, refused: false, model: res.model, error: "output did not match the decision schema" };
    }
    return { decision: parsed.data, refused: false, model: res.model };
  } catch (e) {
    return { decision: null, refused: false, model: MODEL, error: e instanceof Error ? e.message : String(e) };
  }
}
