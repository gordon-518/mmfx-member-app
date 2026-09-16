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
// A contiguous 6-9 digit token, bounded by \b on both sides. Used alongside
// IB_SEP_RE (below) so two adjacent numbers ("47807426, 5928887") are each
// caught on their own: a plain \d{6,9} run can never bridge a comma/space,
// so it can't merge two numbers into one over-long token the way the
// separator-tolerant scan alone can (see ibMatches).
const IB_PLAIN_RE = /\b\d{6,9}\b/g;
// A single number's digits spread across separators — space, comma, dot or
// dash — e.g. "592 8887", "5,928,887", "592-8887", "5.928.887". Run only
// against text that's had dates and decimal amounts masked out first
// (maskDatesAndDecimals), so "2026-12-15" and "1,588.00" are never swept up
// as a "separated" IB number.
const IB_SEP_RE = /\b\d[\d ,.-]{4,}\d\b/g;
// Masked out before IB_SEP_RE runs, so their dashes/dots never look like a
// separated IB number: a "2026-12-15"-shaped date, and a "588.00"-shaped
// decimal fraction (covers "$1,588.00" too, since the ",588" part alone is
// too short for IB_SEP_RE's minimum length once the ".00" is masked).
const DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/g;
const DECIMAL_RE = /\b\d+\.\d{2}\b/g;
// A number is being presented as an IB/partner number, not just an account
// number — used to stop the member-wrote-it exemption from whitewashing the
// competing IB when the draft itself labels the member's own number as one.
const IB_CONTEXT_RE = /\b(?:ib(?:\s*number)?|partner code)\b/i;
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
// A bare host with no path at all ("www.evil.com", "evil-signals.com now") —
// URL_RE's schemeless alt requires a trailing "/", so this catches what it
// misses. TLD list is deliberately conservative (real ones seen in fact-sheet
// or member-chat links, plus common scam-domain endings) so it doesn't fire
// on ordinary prose like "Node.js" or "e.g." (neither "js" nor "g" is on it).
const BARE_HOST_RE =
  /\b(?:[a-z0-9-]+\.)+(?:com|net|org|me|io|co|my|sg|id|ph|trade|gle|app|info|biz|xyz|online|site|club|vip|shop|live|pro|link|top|fun)\b/gi;
const HANDLE_RE = /(^|[^\w@])@([A-Za-z0-9_]{3,32})/g;
// Profit/return language. The soft, easily-innocent words ("earn", "gains")
// only count in money-or-rate context — "earn your Foundation tier" and
// "earned Foundation" aren't profit claims, but "earn $50"/"earn more" is;
// "gains and losses" is risk-disclosure language, "gains of 5%" isn't.
// "double"/"10x" phrasing and adverbial rate phrasing ("5% weekly", no "a"
// or "per") are additions the old list missed.
const PROFIT_RE =
  /\b(guarantee[ds]?|profits?|profitable|returns|printing|make money|risk[- ]free|double(?:s|d|ing)?\s+(?:your|the|it|in)|earn(?:s|ing|ed)?\s+(?:\$|\d|money|income|profits?|more)|income|gains?\s+of\b|capital gains|roi|win(?:ning)?\s+(?:every|all)|compound(?:ing|s)?|\d+x\b)\b|\d+\s?%\s?(?:a\s|per\s)?(?:daily|weekly|monthly|yearly|day|week|month|year)/i;
// A deposit reference code (depositRef.ts): "MM-" + 6 hex chars, ~6% all digits.
// Not an IB number and not a bonus code — stripped before those two checks.
const REF_CODE_RE = /\bMM-[0-9a-f]{6}\b/gi;
// Phrases like "Nothing is guaranteed" / "We can't promise any income" are
// the opposite of a claim, not a violation — stripped (after the exact risk
// footer) before testing for profit language. Covers all three words the
// fact sheet itself uses in the negative (guarantee, promise, income).
const NEGATED_CLAIM_RE = /\b(?:no|not|never|nothing|can'?t|cannot)\b[^.!?]{0,25}\b(?:guarantee|promise|income)\w*/gi;
// A claim that money/funds/capital/deposits are safe, secure, protected or
// guaranteed — the fact sheet explicitly bans this ("Never tell anyone their
// money is safe or protected"). That instruction itself is skipped via
// MONEY_SAFE_VETO_RE below (it's a rule, not a claim).
const MONEY_SAFE_RE =
  /\b(?:money|funds?|capital|deposits?)\b[^.!?]{0,20}\b(?:is|are)\b[^.!?]{0,15}\b(?:safe|secure|protected|guaranteed)\b|\bsafe with us\b/i;
const MONEY_SAFE_VETO_RE = /\b(?:never|don'?t|do not|nobody|no one)\b/i;

// --- Deposit-approval claims ------------------------------------------------
// "approved"/"verified" etc. are only a problem when they're actually about
// a deposit, so both words are located independently and checked for
// proximity, rather than one big regex — that's what lets the veto window
// below be measured from the approval word itself, wherever the deposit word
// falls relative to it.
const APPROVAL_WORD_RE = /\b(approved|verified|confirmed|received)\b/gi;
const DEPOSIT_WORD_RE = /\b(deposit|top-?up|submission)\b/i;
// Words that turn an approval word from a settled-fact claim into something
// else: a negation ("hasn't been approved"), a condition ("once/when/
// after/until/if/unless it's approved"), or a future/would tense ("will/
// would approve"). "as soon as" covers the fact sheet's own phrasing for
// when trial access upgrades — a condition in the same family as "once".
// Bare "soon" ("Access opens soon, and your deposit is approved.") is NOT a
// condition on the approval itself and must not veto it.
const CLAIM_VETO_RE = /\b(not|no|n't|isn't|hasn't|haven't|once|when|after|until|will|would|if|unless|as soon as)\b/i;
// A promise that a *person* (not the agent) will do the approving — blocked
// even with a verified submission, since the agent can never commit someone
// else to an action. Covers present-continuous ("Amelia is approving it")
// as well as future tense, with a small filler-word allowance ("will check
// and approve"). A preceding negation ("Nobody will approve...") is a
// general statement, not a promise about this member, so it's vetoed.
const APPROVAL_PROMISE_RE = /\b(?:will|'ll|going to|gonna)\s+(?:\w+\s+){0,2}approve\b|\bis\s+approving\b/i;
const APPROVAL_PROMISE_VETO_RE = /\b(?:nobody|no\s?one|never|not)\b/i;

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

/** Masks "2026-12-15"-shaped dates and "588.00"-shaped decimal fractions
 * with "#" (same length, so match indices are unaffected) before the
 * separator-tolerant IB scan runs — otherwise their dashes/dots read as a
 * separated IB number. */
function maskDatesAndDecimals(text: string): string {
  return text
    .replace(DATE_RE, (m) => "#".repeat(m.length))
    .replace(DECIMAL_RE, (m) => "#".repeat(m.length));
}

/** Every 6-9 digit account/IB-shaped number in text, with its index, via the
 * union of a plain contiguous scan and a separator-tolerant scan. The union
 * matters: the separator scan alone would merge two adjacent numbers
 * ("47807426, 5928887") into one over-long token that then fails the 6-9
 * length filter and is silently dropped, missing both. */
function ibMatches(text: string): { digits: string; index: number }[] {
  const masked = maskDatesAndDecimals(text);
  const found = [
    ...[...text.matchAll(IB_PLAIN_RE)].map((m) => ({ token: m[0], index: m.index ?? 0 })),
    ...[...masked.matchAll(IB_SEP_RE)].map((m) => ({ token: m[0], index: m.index ?? 0 })),
  ];
  return found
    .map(({ token, index }) => ({ digits: token.replace(/[ ,.-]/g, ""), index }))
    .filter(({ digits }) => digits.length >= 6 && digits.length <= 9);
}

const CLAUSE_BOUNDARY_CHARS = [",", ";", ":", ".", "!", "?", "—", "\n"];
/** The text since the last clause boundary before `idx`, capped at
 * `maxLen` characters — so a veto/negation word sitting in a *previous*
 * clause of the same message never leaks into the window being checked. */
function clauseBefore(text: string, idx: number, maxLen: number): string {
  const start = Math.max(0, idx - maxLen);
  const slice = text.slice(start, idx);
  const cut = Math.max(...CLAUSE_BOUNDARY_CHARS.map((c) => slice.lastIndexOf(c)));
  return cut === -1 ? slice : slice.slice(cut + 1);
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

/** Hostnames the bare-host scan must never flag: every host behind an
 * allow-listed URL, plus the app's own host (already covered separately by
 * urlAllowed/APP_PATHS, but the bare-host scan works on hosts alone). */
function allowedHosts(f: FactSheet): Set<string> {
  const hosts = new Set<string>(["app.marketmakersfx.net"]);
  for (const raw of f.allow.urls) {
    const normalised = normaliseUrl(raw);
    if (normalised === null) continue;
    try {
      hosts.add(new URL(normalised).host.toLowerCase());
    } catch {
      // Malformed URL on the fact sheet's own allow-list — nothing to add.
    }
  }
  return hosts;
}

/** A promise that someone will approve the deposit — always blocked unless
 * vetoed by a preceding negation ("Nobody will approve..."). Kept as a small
 * function (rather than inlined) so the veto window is measured from the
 * match's real position via clauseBefore. */
function approvalPromiseReason(draft: string): string | null {
  const m = draft.match(APPROVAL_PROMISE_RE);
  if (!m) return null;
  const idx = m.index ?? 0;
  if (APPROVAL_PROMISE_VETO_RE.test(clauseBefore(draft, idx, 30))) return null;
  return "promises a person will approve the deposit, which the agent can't commit anyone to";
}

/** An affirmative claim that a deposit already is approved (blocked only
 * without a verified submission), and/or a promise that someone will
 * approve it (always blocked — see approvalPromiseReason). Kept as a small
 * function rather than one regex so the veto window can be measured from
 * the approval word's real position. */
function depositClaimReasons(draft: string, verified: boolean): string[] {
  const reasons: string[] = [];
  if (!verified) {
    for (const m of draft.matchAll(APPROVAL_WORD_RE)) {
      const idx = m.index ?? 0;
      const around = draft.slice(Math.max(0, idx - 60), idx + m[0].length + 60);
      if (!DEPOSIT_WORD_RE.test(around)) continue; // this approval word isn't about a deposit
      if (CLAIM_VETO_RE.test(clauseBefore(draft, idx, 30))) continue; // negated, conditional, or future — not a claim
      reasons.push("claims a deposit is received or approved without a verified submission");
      break;
    }
  }
  const promiseReason = approvalPromiseReason(draft);
  if (promiseReason) reasons.push(promiseReason);
  return reasons;
}

export function checkDraft(
  draft: string,
  ctx: { facts: FactSheet; memberTexts: string[]; member: MemberContext | null }
): string[] {
  const f = ctx.facts;
  // Compliance reasons (money-safe, profit, deposit claim, approval promise)
  // are ordered ahead of everything else before the MAX_REASONS cap, so a
  // kitchen-sink draft with many small violations can't crowd them out.
  const complianceFails: string[] = [];
  const otherFails: string[] = [];

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
  if (badAmounts.length) {
    otherFails.push(`amount not on the fact sheet: ${[...new Set(badAmounts.map((a) => a.label))].join(", ")}`);
  }

  // A deposit reference code (e.g. "MM-123456") is not an IB number or a
  // bonus code, even when it happens to be all digits — strip it before
  // those two checks so it's never mistaken for either.
  const draftLessRefCodes = draft.replace(REF_CODE_RE, "");

  // A member's own account number, pasted back to them, is not a wrong IB —
  // members paste 6-9 digit account numbers constantly.
  const memberDigits = new Set(ctx.memberTexts.flatMap((t) => ibMatches(t).map((m) => m.digits)));
  const ibs = ibMatches(draftLessRefCodes)
    .filter((m) => m.digits !== f.allow.ibNumber)
    .filter((m) => {
      if (!memberDigits.has(m.digits)) return true;
      // The member exemption doesn't cover a number the draft itself
      // presents as an IB/partner code — that's exactly the competing-IB
      // whitewash this rule exists to catch, even when the member happens
      // to have pasted that same number as their own account earlier.
      return IB_CONTEXT_RE.test(draftLessRefCodes.slice(Math.max(0, m.index - 12), m.index));
    })
    .map((m) => m.digits);
  if (ibs.length) {
    otherFails.push(`IB-style number not ours: ${[...new Set(ibs)].join(", ")} (only ${f.allow.ibNumber})`);
  }

  const bonusValues: string[] = [];
  const seenBonusTokens = new Set<string>();
  for (const code of draftLessRefCodes.match(BONUS_RE) ?? []) {
    const normalisedCode = code.replace(/\s/g, "").toLowerCase();
    seenBonusTokens.add(normalisedCode);
    const ok = f.allow.bonusCode !== null && normalisedCode === f.allow.bonusCode.toLowerCase();
    if (!ok) bonusValues.push(code);
  }
  for (const m of draftLessRefCodes.matchAll(CODE_RE)) {
    const token = m[1];
    // A real code always has a digit or reads fully upper-case ("XYZ99",
    // "WELCOME"); a plain capitalised word right after "code" ("the code
    // Amelia sent you") is prose, not a pasted code.
    if (!(/\d/.test(token) || token === token.toUpperCase())) continue;
    const tokenLower = token.toLowerCase();
    if (seenBonusTokens.has(tokenLower)) continue; // already reported above
    if (f.allow.bonusCode !== null && tokenLower === f.allow.bonusCode.toLowerCase()) continue;
    bonusValues.push(token);
  }
  if (bonusValues.length) otherFails.push(`bonus code not current: ${[...new Set(bonusValues)].join(", ")}`);

  const rawUrls = draft.match(URL_RE) ?? [];
  const badUrls = new Set<string>();
  for (const u of rawUrls) if (!urlAllowed(u, f)) badUrls.add(u);
  const allowedHostSet = allowedHosts(f);
  for (const m of draft.matchAll(BARE_HOST_RE)) {
    const host = m[0];
    const idx = m.index ?? 0;
    if (draft[idx - 1] === "@") continue; // the domain half of an email address, not a link
    const lower = host.toLowerCase();
    if (allowedHostSet.has(lower)) continue;
    if (rawUrls.some((u) => u.toLowerCase().includes(lower))) continue; // already reported above, full link and all
    badUrls.add(host);
  }
  if (badUrls.size) otherFails.push(`link not allowed: ${[...badUrls].join(", ")}`);

  const handleFails: string[] = [];
  for (const m of draft.matchAll(HANDLE_RE)) {
    const atIndex = (m.index ?? 0) + m[1].length;
    const after = draft.slice(atIndex + 1 + m[2].length);
    // An email address ("support@example.com", "支援@example.com") reads as
    // a dot or "@" immediately after the candidate handle — skip those.
    // Anything else that got this far (even "(@scammer)" or "@scammer,")
    // is a real Telegram-style mention and must be checked against the
    // allow-list.
    if (/^[.@][A-Za-z0-9-]/.test(after)) continue;
    if (!f.allow.handles.has(m[2].toLowerCase())) handleFails.push(`@${m[2]}`);
  }
  if (handleFails.length) otherFails.push(`handle not official: ${[...new Set(handleFails)].join(", ")}`);

  // Money/funds "safe" claims: the fact sheet's own ban on this phrasing
  // ("Never tell anyone their money is safe or protected") is an
  // instruction, not a claim, and is vetoed via MONEY_SAFE_VETO_RE.
  const moneySafeMatch = draft.match(MONEY_SAFE_RE);
  if (moneySafeMatch) {
    const idx = moneySafeMatch.index ?? 0;
    if (!MONEY_SAFE_VETO_RE.test(clauseBefore(draft, idx, 40))) {
      complianceFails.push(`claims money or funds are safe: "${moneySafeMatch[0]}"`);
    }
  }

  // Profit/return language: the verbatim risk footer and negated-claim
  // phrases ("We can't promise any income") are compliance-safe, not
  // violations.
  const profitCheckText = draft.split(RISK_FOOTER).join("").replace(NEGATED_CLAIM_RE, "");
  const profitMatch = profitCheckText.match(PROFIT_RE);
  if (profitMatch) complianceFails.push(`profit or return language: "${profitMatch[0]}"`);

  complianceFails.push(...depositClaimReasons(draft, ctx.member?.submission?.status === "verified"));

  if (draft.length > MAX_REPLY_CHARS) otherFails.push(`too long (${draft.length} > ${MAX_REPLY_CHARS})`);

  // Dedupe (e.g. the same handle mentioned twice) and cap: these reasons are
  // fed back into a redraft prompt and stored, not just displayed once.
  // Compliance reasons are listed first so they always survive the cap.
  return [...new Set([...complianceFails, ...otherFails])].slice(0, MAX_REASONS);
}

const ALWAYS_HUMAN: [RegExp, string][] = (() => {
  // Money words that scope certain Malay phrases below to an actual funds
  // context. "belum masuk", "tarik balik" and "bayar balik" are also used
  // for plain non-money things ("akses belum masuk", "tarik balik soalan",
  // "bayar balik bulan depan") and must not be misrouted as urgent money
  // issues just because the bare phrase appears.
  const money = "(?:duit|wang|deposit|bayaran|top ?up)";
  return [
    [
      new RegExp(
        `\\bwithdraw(al|ing)?\\b|keluarkan duit|pengeluaran|提款|出金|` +
          `tarik balik[^.!?]{0,20}${money}|${money}[^.!?]{0,20}tarik balik`,
        "i"
      ),
      "withdrawal",
    ],
    [
      new RegExp(`\\b(refund|chargeback)\\b|退款|bayar balik[^.!?]{0,20}${money}|${money}[^.!?]{0,20}bayar balik`, "i"),
      "refund",
    ],
    [
      /\b(i|we)\s+(have\s+)?(paid|transferred|sent (the )?money|made the payment)\b|\btransfer is done\b|sudah bayar|dah bayar|telah bayar|已付款|已经付款/i,
      "payment already made",
    ],
    [
      new RegExp(
        `\\b(missing|lost|stuck|disappeared)\\b[^.!?]{0,40}\\b(funds?|money|deposit|balance)\\b|` +
          `\\b(funds?|money|deposit)\\b[^.!?]{0,40}\\b(not (arrived|received|showing|reflected)|missing)\\b|` +
          `duit .{0,20}hilang|wang .{0,20}hilang|钱没到|未到账|` +
          `belum masuk[^.!?]{0,20}${money}|${money}[^.!?]{0,20}belum masuk`,
        "i"
      ),
      "missing or pending funds",
    ],
    [/\b(scam|fraud|lawyer|police|sue|report you|complain(t)?)\b/i, "dispute or complaint"],
    [/\bdelete (my )?(account|data)\b|\bremove my (account|data)\b|padam akaun|hapus akaun|删除账户|close my account/i, "account deletion"],
  ];
})();
const HUMAN_TOPICS: Partial<Record<Topic, string>> = { money: "money topic", complaint: "dispute or complaint", deletion: "account deletion" };

/** A reason when the member's message must go to a human regardless of the draft. */
export function mustHandOff(memberText: string, topic: Topic): string | null {
  for (const [re, why] of ALWAYS_HUMAN) if (re.test(memberText)) return why;
  return HUMAN_TOPICS[topic] ?? null;
}
