import { normaliseUrl, RISK_FOOTER } from "./facts";
import type { FactSheet, MemberContext, Topic } from "./types";

// Pure checks on a drafted reply. An empty array means it may be sent. Every
// failure is a short reason, fed back to the model for one redraft.

export const MAX_REPLY_CHARS = 900;

const AMOUNT_RE = /(?:\$|us\$|usd\s?)\s?(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s?(?:usd|dollars?)\b/gi;
const IB_RE = /\b\d{6,9}\b/g;
const BONUS_RE = /\bteam\s?mm\d+\b/gi;
// Other bonus-code shapes: "code WELCOME50" etc. Letters, then at least one digit.
const CODE_RE = /\bcode[:\s]+([A-Za-z][A-Za-z]*\d[A-Za-z0-9]*)\b/gi;
const URL_RE = /\bhttps?:\/\/[^\s)>\]]+|\b(?:app\.marketmakersfx\.net|t\.me|dupoin\.me|clickto\.trade|my\.octabroker\.com|my\.elev8\.com|forms\.gle|docs\.google\.com|wa\.me)\/[^\s)>\]]*/gi;
const HANDLE_RE = /(^|[^\w@])@([A-Za-z0-9_]{3,32})/g;
const PROFIT_RE = /\b(guarantee[ds]?|profits?|profitable|returns|printing|make money|risk[- ]free|double (?:your|the))\b/i;
const DEPOSIT_CLAIM_RE = /(deposit|top-?up|submission)[^.!?\n]{0,60}\b(approved|verified|confirmed|received)\b|\b(approved|verified|confirmed|received)\b[^.!?\n]{0,60}(deposit|top-?up|submission)/i;
// A deposit reference code (depositRef.ts): "MM-" + 6 hex chars, ~6% all digits.
// Not an IB number and not a bonus code — stripped before those two checks.
const REF_CODE_RE = /\bMM-[0-9a-f]{6}\b/gi;
// Phrases like "Nothing is guaranteed" / "No returns are guaranteed" are the
// opposite of a profit claim — stripped (after the exact risk footer) before
// testing for profit language.
const NEGATED_GUARANTEE_RE = /\b(no|not|never|nothing)\b[^.!?]{0,25}\bguarantee\w*/gi;

const APP_ORIGIN = "https://app.marketmakersfx.net";

function amounts(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const n = Number((m[1] ?? m[2] ?? "").replace(/,/g, ""));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** Strips exactly one trailing "/", if present. Used so "/upgrade/" and
 * "/upgrade" (and a bare domain with or without "/") compare equal. */
function stripOneTrailingSlash(s: string): string {
  return s.length > 1 && s.endsWith("/") ? s.slice(0, -1) : s;
}

/** Normalises an app-relative path for comparison against APP_PATHS: "" and
 * "/" both become "/"; anything longer loses one trailing "/". */
function normalisePath(p: string): string {
  if (p === "" || p === "/") return "/";
  return stripOneTrailingSlash(p);
}

function urlAllowed(raw: string, facts: FactSheet): boolean {
  const normalised = normaliseUrl(raw);
  if (normalised === null) return false;
  const trimmed = stripOneTrailingSlash(normalised);
  if (facts.allow.urls.some((u) => stripOneTrailingSlash(u) === trimmed)) return true;
  if (normalised.startsWith(APP_ORIGIN)) {
    const rawPath = normalised.slice(APP_ORIGIN.length).split(/[?#]/)[0];
    return facts.allow.appPaths.includes(normalisePath(rawPath));
  }
  return false;
}

export function checkDraft(
  draft: string,
  ctx: { facts: FactSheet; memberTexts: string[]; member: MemberContext | null }
): string[] {
  const f = ctx.facts;
  const fails: string[] = [];

  const memberAmounts = new Set(
    ctx.memberTexts.flatMap((t) => [
      ...amounts(t),
      ...(t.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((x) => Number(x.replace(/,/g, ""))),
    ])
  );
  const bad = amounts(draft).filter((n) => !f.allow.amounts.has(n) && !memberAmounts.has(n));
  if (bad.length) fails.push(`amount not on the fact sheet: ${bad.join(", ")}`);

  // A deposit reference code (e.g. "MM-123456") is not an IB number or a
  // bonus code, even when it happens to be all digits — strip it before
  // those two checks so it's never mistaken for either.
  const draftLessRefCodes = draft.replace(REF_CODE_RE, "");

  const ibs = (draftLessRefCodes.match(IB_RE) ?? []).filter((n) => n !== f.allow.ibNumber);
  if (ibs.length) fails.push(`IB-style number not ours: ${ibs.join(", ")} (only ${f.allow.ibNumber})`);

  const bonusFails: string[] = [];
  const seenBonusTokens = new Set<string>();
  for (const code of draftLessRefCodes.match(BONUS_RE) ?? []) {
    const normalisedCode = code.replace(/\s/g, "").toLowerCase();
    seenBonusTokens.add(normalisedCode);
    const ok = f.allow.bonusCode !== null && normalisedCode === f.allow.bonusCode.toLowerCase();
    if (!ok) bonusFails.push(`bonus code not current: ${code}`);
  }
  for (const m of draftLessRefCodes.matchAll(CODE_RE)) {
    const token = m[1];
    const tokenLower = token.toLowerCase();
    if (seenBonusTokens.has(tokenLower)) continue; // already reported above
    if (f.allow.bonusCode !== null && tokenLower === f.allow.bonusCode.toLowerCase()) continue;
    if (tokenLower === f.allow.ibNumber.toLowerCase()) continue;
    bonusFails.push(`bonus code not current: ${token}`);
  }
  fails.push(...bonusFails);

  const badUrls = (draft.match(URL_RE) ?? []).filter((u) => !urlAllowed(u, f));
  if (badUrls.length) fails.push(`link not allowed: ${badUrls.join(", ")}`);

  for (const m of draft.matchAll(HANDLE_RE)) {
    if (!f.allow.handles.has(m[2].toLowerCase())) fails.push(`handle not official: @${m[2]}`);
  }

  // Profit/return language: the verbatim risk footer and negated-guarantee
  // phrases ("Nothing is guaranteed") are compliance-safe, not violations.
  const profitCheckText = draft.split(RISK_FOOTER).join("").replace(NEGATED_GUARANTEE_RE, "");
  const profitMatch = profitCheckText.match(PROFIT_RE);
  if (profitMatch) fails.push(`profit or return language: "${profitMatch[0]}"`);

  if (DEPOSIT_CLAIM_RE.test(draft) && ctx.member?.submission?.status !== "verified") {
    fails.push("claims a deposit is received or approved without a verified submission");
  }

  if (draft.length > MAX_REPLY_CHARS) fails.push(`too long (${draft.length} > ${MAX_REPLY_CHARS})`);
  return fails;
}

const ALWAYS_HUMAN: [RegExp, string][] = [
  [/\bwithdraw(al|ing)?\b/i, "withdrawal"],
  [/\b(refund|chargeback)\b/i, "refund"],
  [/\b(i|we)\s+(have\s+)?(paid|transferred|sent (the )?money)\b/i, "payment already made"],
  [/\b(missing|lost|stuck|disappeared)\b[^.!?]{0,40}\b(funds?|money|deposit|balance)\b|\b(funds?|money|deposit)\b[^.!?]{0,40}\b(not (arrived|received|showing|reflected)|missing)\b/i, "missing or pending funds"],
  [/\b(scam|fraud|lawyer|police|sue|report you|complain(t)?)\b/i, "dispute or complaint"],
  [/\bdelete (my )?(account|data)\b|\bremove my (account|data)\b/i, "account deletion"],
];
const HUMAN_TOPICS: Partial<Record<Topic, string>> = { money: "money topic", complaint: "dispute or complaint", deletion: "account deletion" };

/** A reason when the member's message must go to a human regardless of the draft. */
export function mustHandOff(memberText: string, topic: Topic): string | null {
  for (const [re, why] of ALWAYS_HUMAN) if (re.test(memberText)) return why;
  return HUMAN_TOPICS[topic] ?? null;
}
