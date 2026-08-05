// Blocks copy that leaks IB mechanics or makes disallowed claims. Case-
// insensitive; returns the matched fragments so a rejected draft is auditable.
const BLOCKED: RegExp[] = [
  /\bguarantee(?:d|s)?\b/i,
  /\bno[-\s]?loss\b/i,
  /\b47807426\b/,               // IB number
  /\$?\d+\s*\/\s*lot\b/i,        // per-lot payout figures
  /\brebate(?:s)?\b/i,
  /\bIB\s*link\b/i,
];

export interface LintResult { ok: boolean; hits: string[]; }

export function lintPost(text: string): LintResult {
  const hits: string[] = [];
  for (const re of BLOCKED) {
    const m = text.match(re);
    if (m) hits.push(m[0]);
  }
  return { ok: hits.length === 0, hits };
}
