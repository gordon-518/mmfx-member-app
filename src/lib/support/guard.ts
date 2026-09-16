import { normaliseUrl, RISK_FOOTER } from "./facts";
import type { FactSheet, MemberContext, Topic } from "./types";

// Pure checks on a drafted reply. An empty array means it may be sent. Every
// failure is a short reason, fed back to the model for one redraft.

export const MAX_REPLY_CHARS = 900;
// Reasons are fed back into a redraft prompt and stored — cap how many ride
// along, after dedupe, so one repeated mistake can't crowd out the rest.
const MAX_REASONS = 6;

// A number, with "," or a space as an optional thousands separator
// ("1,000", "1 000"), reused by both the currency-prefix and the
// currency-suffix ("100 USD") shapes below.
const AMOUNT_NUM = "\\d{1,3}(?:[ ,]\\d{3})*(?:\\.\\d+)?|\\d+(?:\\.\\d+)?";
// A currency amount. $ / US$ / USD is the fact sheet's only real currency;
// RM / MYR / IDR / Rp / SGD / S$ turn up constantly in member chat (Malaysia
// and Indonesia are primary markets) but the fact sheet is USD-only, so any
// amount in one of those currencies is never on it. No trailing \b on the
// word currencies: members write "USD100"/"RM250" with no space before the
// digits, and \b can't sit between two word characters (the last currency
// letter and the first digit) anyway.
const AMOUNT_RE = new RegExp(
  `(\\$|us\\$|s\\$|\\b(?:usd|rm|myr|idr|rp|sgd))\\s?(${AMOUNT_NUM})|(${AMOUNT_NUM})\\s?\\b(?:usd|dollars?)\\b`,
  "gi"
);
// A run of digits with "," or " " as an optional separator ("592 8887",
// "5,928,887"), so a spaced-out or comma-grouped IB number is still caught.
// Kept only when the digits-only length is 6-9 (see ibs/memberDigits below);
// this also matters for not tripping over amounts like "$1,588" (5 chars,
// too short for the {4,} middle run) or hyphenated dates.
const IB_RE = /\b\d[\d ,]{4,}\d\b/g;
const BONUS_RE = /\bteam\s?mm\d+\b/gi;
// Other bonus-code shapes: "code WELCOME50", "coupon XYZ99", "promo WELCOME".
// A leading letter, "is/are" optionally in between, then a token that reads
// like a code (has an uppercase letter or a digit — plain lowercase prose
// like "the code you received" must not match; validated below, since a
// regex can't easily require "has an uppercase OR a digit" itself).
const CODE_RE = /\b(?:code|coupon|promo|voucher|kod)\b(?:\s+(?:is|are))?[\s:]+([A-Za-z][A-Za-z0-9]{3,})\b/gi;
// A generic link: any http(s) URL, or a bare "domain.tld/path" with no
// scheme at all (bit.ly/x, evil-signals.com/pay). Requiring a path after the
// bare domain keeps ordinary prose ("Foundation starts at $50.") from firing.
const URL_RE = /\bhttps?:\/\/[^\s)>\]]+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s)>\]]*/gi;
const HANDLE_RE = /(^|[^\w@])@([A-Za-z0-9_]{3,32})/g;
const PROFIT_RE =
  /\b(guarantee[ds]?|profits?|profitable|returns|printing|make money|risk[- ]free|double (?:your|the)|earn(?:s|ing|ings)?|income|gains?|roi|win(?:ning)?\s+(?:every|all)|compound(?:ing|s)?)\b|\d+\s?%\s?(?:a|per)\s?(?:day|week|month|year)/i;
// A deposit reference code (depositRef.ts): "MM-" + 6 hex chars, ~6% all digits.
// Not an IB number and not a bonus code — stripped before those two checks.
const REF_CODE_RE = /\bMM-[0-9a-f]{6}\b/gi;
// Phrases like "Nothing is guaranteed" / "No returns are guaranteed" are the
// opposite of a profit claim — stripped (after the exact risk footer) before
// testing for profit language.
const NEGATED_GUARANTEE_RE = /\b(no|not|never|nothing)\b[^.!?]{0,25}\bguarantee\w*/gi;

// --- Deposit-approval claims ------------------------------------------------
// "approved"/"verified" etc. are only a problem when they're actually about
// a deposit, so both words are located independently and checked for
// proximity, rather than one big regex — that's what lets the veto window
// below be measured from the approval word itself, wherever the deposit word
// falls relative to it.
const APPROVAL_WORD_RE = /\b(approved|verified|confirmed|received)\b/gi;
const DEPOSIT_WORD_RE = /\b(deposit|top-?up|submission)\b/i;
// Words in the ~30 characters before the approval word that turn it from a
// settled-fact claim into something else: a negation ("hasn't been
// approved"), a condition ("once/when/after/until/if/unless it's approved"),
// or a future/would tense ("will/would approve"). "soon" covers "as soon as"
// — the fact sheet's own phrasing for when trial access upgrades — which is
// a condition in the same family as "once" but not literally that word.
const CLAIM_VETO_RE = /\b(not|no|n't|isn't|hasn't|haven't|once|when|after|until|will|would|if|unless|soon)\b/i;
// A promise that a *person* (not the agent) will do the approving. Blocked
// even with a verified submission — the agent can never commit someone else
// to an action.
const APPROVAL_PROMISE_RE = /\b(?:will|going to)\s+approve\b|\bapproves?\s+it\s+today\b/i;

const APP_ORIGIN = "https://app.marketmakersfx.net";

interface AmountMatch {
  value: number;
  usd: boolean;
  /** "usd" for every dollar spelling, else the matched currency lowercased — used to key the member-wrote-it exemption. */
  key: string;
  /** What shows up in a failure reason: the bare number for USD, "RM250" etc. otherwise. */
  label: string;
}

function amounts(text: string): AmountMatch[] {
  const out: AmountMatch[] = [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const numStr = (m[2] ?? m[3] ?? "").replace(/[ ,]/g, "");
    const value = Number(numStr);
    if (!Number.isFinite(value)) continue;
    const rawCurrency = m[1]; // undefined for the "100 USD" / "100 dollars" suffix form
    const usd = rawCurrency === undefined || /^(\$|us\$|usd)$/i.test(rawCurrency);
    out.push({
      value,
      usd,
      key: usd ? "usd" : rawCurrency.toLowerCase(),
      label: usd ? String(value) : `${rawCurrency}${value}`,
    });
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

/** Lowercases the scheme+host and treats "http://" the same as "https://",
 * leaving the path/query untouched. A member's phone or keyboard routinely
 * changes either, and the destination is the same link either way. */
function canonicaliseUrl(u: string): string {
  return stripOneTrailingSlash(u).replace(
    /^https?:\/\/([^/?#]*)/i,
    (_m, host: string) => `https://${host.toLowerCase()}`
  );
}

function urlAllowed(raw: string, facts: FactSheet): boolean {
  const normalised = normaliseUrl(raw);
  if (normalised === null) return false;
  const canonical = canonicaliseUrl(normalised);
  if (facts.allow.urls.some((u) => canonicaliseUrl(u) === canonical)) return true;
  if (canonical.startsWith(APP_ORIGIN)) {
    const rawPath = canonical.slice(APP_ORIGIN.length).split(/[?#]/)[0];
    return facts.allow.appPaths.includes(normalisePath(rawPath));
  }
  return false;
}

/** A promise that someone will approve the deposit (always blocked), and/or
 * an affirmative claim that it already is approved (blocked only without a
 * verified submission). Kept as a small function rather than one regex so
 * the veto window can be measured from the approval word's real position. */
function depositClaimReasons(draft: string, verified: boolean): string[] {
  const reasons: string[] = [];
  if (APPROVAL_PROMISE_RE.test(draft)) {
    reasons.push("promises a person will approve the deposit, which the agent can't commit anyone to");
  }
  if (!verified) {
    for (const m of draft.matchAll(APPROVAL_WORD_RE)) {
      const idx = m.index ?? 0;
      const around = draft.slice(Math.max(0, idx - 60), idx + m[0].length + 60);
      if (!DEPOSIT_WORD_RE.test(around)) continue; // this approval word isn't about a deposit
      const before = draft.slice(Math.max(0, idx - 30), idx);
      if (CLAIM_VETO_RE.test(before)) continue; // negated, conditional, or future — not a claim
      reasons.push("claims a deposit is received or approved without a verified submission");
      break;
    }
  }
  return reasons;
}

export function checkDraft(
  draft: string,
  ctx: { facts: FactSheet; memberTexts: string[]; member: MemberContext | null }
): string[] {
  const f = ctx.facts;
  const fails: string[] = [];

  // Amounts the member has themselves stated (in the same currency and
  // figure) are exempt — members paste their own numbers back constantly.
  const memberAmountKeys = new Set(
    ctx.memberTexts.flatMap((t) => amounts(t)).map((a) => `${a.key}:${a.value}`)
  );
  const badAmounts = amounts(draft).filter((a) => {
    if (memberAmountKeys.has(`${a.key}:${a.value}`)) return false;
    // A USD figure fails unless it's on the fact sheet; any other currency
    // always fails (the fact sheet never quotes one) unless the member wrote it.
    return a.usd ? !f.allow.amounts.has(a.value) : true;
  });
  if (badAmounts.length) fails.push(`amount not on the fact sheet: ${badAmounts.map((a) => a.label).join(", ")}`);

  // A deposit reference code (e.g. "MM-123456") is not an IB number or a
  // bonus code, even when it happens to be all digits — strip it before
  // those two checks so it's never mistaken for either.
  const draftLessRefCodes = draft.replace(REF_CODE_RE, "");

  // A member's own account number, pasted back to them, is not a wrong IB —
  // members paste 6-9 digit account numbers constantly. Scanned the same
  // separator-tolerant way as the draft itself.
  const memberDigits = new Set(
    ctx.memberTexts
      .flatMap((t) => t.match(IB_RE) ?? [])
      .map((raw) => raw.replace(/[ ,]/g, ""))
      .filter((digits) => digits.length >= 6 && digits.length <= 9)
  );
  const ibs = (draftLessRefCodes.match(IB_RE) ?? [])
    .map((raw) => raw.replace(/[ ,]/g, ""))
    .filter((digits) => digits.length >= 6 && digits.length <= 9)
    .filter((digits) => digits !== f.allow.ibNumber && !memberDigits.has(digits));
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
    // A real code is always upper-cased or has a digit; a plain lowercase
    // word right after "code" ("the code you received") is prose, not one.
    if (!/[A-Z0-9]/.test(token)) continue;
    const tokenLower = token.toLowerCase();
    if (seenBonusTokens.has(tokenLower)) continue; // already reported above
    if (f.allow.bonusCode !== null && tokenLower === f.allow.bonusCode.toLowerCase()) continue;
    bonusFails.push(`bonus code not current: ${token}`);
  }
  fails.push(...bonusFails);

  const badUrls = (draft.match(URL_RE) ?? []).filter((u) => !urlAllowed(u, f));
  if (badUrls.length) fails.push(`link not allowed: ${badUrls.join(", ")}`);

  for (const m of draft.matchAll(HANDLE_RE)) {
    const atIndex = (m.index ?? 0) + m[1].length;
    const before = draft[atIndex - 1];
    // An email address ("support@example.com") is not a Telegram handle:
    // skip when "@" sits directly against another character (not
    // whitespace, not the start of the message), or is immediately followed
    // by a ".tld"-shaped domain suffix.
    if (before !== undefined && !/\s/.test(before)) continue;
    const after = draft.slice(atIndex + 1 + m[2].length);
    if (/^\.[a-z]{2,}/i.test(after)) continue;
    if (!f.allow.handles.has(m[2].toLowerCase())) fails.push(`handle not official: @${m[2]}`);
  }

  // Profit/return language: the verbatim risk footer and negated-guarantee
  // phrases ("Nothing is guaranteed") are compliance-safe, not violations.
  const profitCheckText = draft.split(RISK_FOOTER).join("").replace(NEGATED_GUARANTEE_RE, "");
  const profitMatch = profitCheckText.match(PROFIT_RE);
  if (profitMatch) fails.push(`profit or return language: "${profitMatch[0]}"`);

  fails.push(...depositClaimReasons(draft, ctx.member?.submission?.status === "verified"));

  if (draft.length > MAX_REPLY_CHARS) fails.push(`too long (${draft.length} > ${MAX_REPLY_CHARS})`);

  // Dedupe (e.g. the same handle mentioned twice) and cap: these reasons are
  // fed back into a redraft prompt and stored, not just displayed once.
  return [...new Set(fails)].slice(0, MAX_REASONS);
}

const ALWAYS_HUMAN: [RegExp, string][] = [
  [/\bwithdraw(al|ing)?\b|keluarkan duit|pengeluaran|tarik balik|提款|出金/i, "withdrawal"],
  [/\b(refund|chargeback)\b|bayar balik|退款/i, "refund"],
  [
    /\b(i|we)\s+(have\s+)?(paid|transferred|sent (the )?money|made the payment)\b|\btransfer is done\b|sudah bayar|dah bayar|telah bayar|已付款|已经付款/i,
    "payment already made",
  ],
  [
    /\b(missing|lost|stuck|disappeared)\b[^.!?]{0,40}\b(funds?|money|deposit|balance)\b|\b(funds?|money|deposit)\b[^.!?]{0,40}\b(not (arrived|received|showing|reflected)|missing)\b|duit .{0,20}hilang|wang .{0,20}hilang|belum masuk|钱没到|未到账/i,
    "missing or pending funds",
  ],
  [/\b(scam|fraud|lawyer|police|sue|report you|complain(t)?)\b/i, "dispute or complaint"],
  [/\bdelete (my )?(account|data)\b|\bremove my (account|data)\b|padam akaun|hapus akaun|删除账户|close my account/i, "account deletion"],
];
const HUMAN_TOPICS: Partial<Record<Topic, string>> = { money: "money topic", complaint: "dispute or complaint", deletion: "account deletion" };

/** A reason when the member's message must go to a human regardless of the draft. */
export function mustHandOff(memberText: string, topic: Topic): string | null {
  for (const [re, why] of ALWAYS_HUMAN) if (re.test(memberText)) return why;
  return HUMAN_TOPICS[topic] ?? null;
}
