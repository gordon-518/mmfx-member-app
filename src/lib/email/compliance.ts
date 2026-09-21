// The compliance gate for lifecycle email copy.
//
// The RULES array below is VENDORED from the Marketing Brain's public-copy gate:
//   source: MM Main Marketing Brain — src/content/compliance.ts
//   copied: 2026-09-21 (regexes and severities unchanged)
// It is vendored rather than imported because the two repos do not share a
// package. If the brain's rules change, re-copy them here; the lifecycle test
// is what keeps the twelve templates honest against this file.
//
// Two severities, deliberately (the brain's reasoning): "block" is an
// unambiguous claim ban, "review" is language that is legitimate in a members-
// only context but needs a human before it goes out in public. Email is public
// copy, so the templates are written to score "pass" — neither.
//
// One rule is NOT from the brain: `pressure`. Deadline and scarcity framing is
// a problem for a Singapore audience under MAS conduct expectations, and the
// lifecycle emails are calendar-driven, which is exactly where that framing
// creeps in. It blocks.

export type Severity = "block" | "review";
export type Verdict = "block" | "review" | "pass";

export type Hit = { rule: string; severity: Severity; match: string };
export type LintResult = { verdict: Verdict; hits: Hit[] };

type Rule = { name: string; severity: Severity; re: RegExp };

const RULES: Rule[] = [
  // --- Unambiguous claim bans ---------------------------------------------
  { name: "guaranteed", severity: "block", re: /\bguarantee(?:d|s|ing)?\b/i },
  { name: "no_loss", severity: "block", re: /\bno[-\s]?loss\b/i },
  { name: "risk_free", severity: "block", re: /\brisk[-\s]?free\b/i },
  {
    name: "double_money",
    severity: "block",
    re: /\bdouble\s+(?:your\s+)?(?:money|account|capital)\b/i,
  },
  { name: "get_rich", severity: "block", re: /\b(?:get[-\s]?rich|riches|quick\s+money)\b/i },
  // "returns"/"profits" only when PROMISED, never when describing price behaviour.
  {
    name: "promised_return",
    severity: "block",
    re: /\b(?:guaranteed|assured|consistent|monthly|daily|weekly)\s+(?:\w+\s+)?(?:returns?|profits?|gains?|income)\b/i,
  },
  {
    name: "percent_return",
    severity: "block",
    re: /\b\d{1,3}\s*%\s*(?:\w+\s+)?(?:returns?|profits?|gains?|monthly|weekly|daily)\b/i,
  },
  {
    name: "win_rate",
    severity: "block",
    re: /\b\d{1,3}\s*%\s*win[-\s]?rate\b|\bwin[-\s]?rate\s+of\s+\d{1,3}\s*%/i,
  },
  {
    name: "income_claim",
    severity: "block",
    re: /\b(?:make|earn|profit|pocket)\s+\$?\d[\d,.]*\s*(?:k\b)?\s*(?:a|per|in|every)\s+(?:day|week|month|year|\d+\s+days?)/i,
  },

  // --- Business-mechanics leakage ------------------------------------------
  { name: "ib_number", severity: "block", re: /\b47807426\b/ },
  { name: "ib_link", severity: "block", re: /\bIB\s*(?:link|number|code)\b/i },
  { name: "per_lot_payout", severity: "block", re: /\$\s*\d+(?:\.\d+)?\s*(?:\/|\s+per\s+)lot\b/i },
  { name: "rebate", severity: "block", re: /\brebate(?:s|d)?\b/i },
  { name: "lifetime_price", severity: "block", re: /\blifetime\b[^.]{0,40}\$\s*\d/i },

  // --- Pressure framing (email-specific, not from the brain) ----------------
  {
    name: "pressure",
    severity: "block",
    re: /\b(?:last chance|hurry|don'?t miss|expires? (?:today|tonight|soon)|act now|only \d+ (?:left|spots))\b/i,
  },

  // --- Results language: legitimate in context, needs a human in public -----
  {
    name: "results_paid",
    severity: "review",
    re: /\b(?:targets?|trades?|setups?|calls?|rejections?|bounces?|entries|entry|zones?|shelf)\s+(?:paid|delivered|hit)\b/i,
  },
  { name: "results_delivery", severity: "review", re: /\bdeliver(?:y|ies)\b/i },
  { name: "results_pips", severity: "review", re: /\b\d{2,}\s*pips?\b/i },
  {
    name: "results_streak",
    severity: "review",
    re: /\b(?:\d+\s+)?(?:winners?|wins)\s+in\s+a\s+row\b/i,
  },
];

/** Lint one piece of email copy — a subject, a text body, or stripped HTML. */
export function lintEmail(text: string): LintResult {
  const hits: Hit[] = [];

  for (const rule of RULES) {
    const m = text.match(rule.re);
    if (m) hits.push({ rule: rule.name, severity: rule.severity, match: m[0] });
  }

  const verdict: Verdict = hits.some((h) => h.severity === "block")
    ? "block"
    : hits.length
      ? "review"
      : "pass";

  return { verdict, hits };
}

/** Everything an email shows a reader, minus the markup, as one lintable string. */
export function emailLintText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
