import type { AssetClass } from "@/lib/fa/types";
import type { TermId } from "@/lib/fa/glossary/terms";
import type { ResolvedTerm } from "@/lib/fa/glossary/types";
import { segment } from "@/lib/fa/glossary/match";
import { TermTip, type TermTipLabels } from "./TermTip";

// The desk's own sentences with its jargon underlined. Splitting happens here
// on the server; only the terms this thesis actually uses travel to the
// browser, already resolved for this instrument and language.

export interface Gloss {
  assetClass: AssetClass;
  terms: Partial<Record<TermId, ResolvedTerm>>;
  labels: TermTipLabels;
}

export function Glossed({ text, gloss }: { text: string; gloss: Gloss }) {
  return (
    <>
      {segment(text, gloss.assetClass).map((s, i) => {
        const term = s.kind === "term" ? gloss.terms[s.id] : undefined;
        return term ? <TermTip key={i} text={s.text} term={term} labels={gloss.labels} /> : <span key={i}>{s.text}</span>;
      })}
    </>
  );
}

/** Every term in this thesis, as plain expandable rows — works without JavaScript. */
export function KeyTerms({ terms, labels }: { terms: ResolvedTerm[]; labels: TermTipLabels }) {
  return (
    <ul className="divide-y divide-line">
      {terms.map((term) => (
        <li key={term.id}>
          <details className="group py-2.5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13.5px] font-semibold text-ink">
              {term.name}
              <span aria-hidden className="text-faint transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 text-[13px] leading-relaxed text-ink">{term.what}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-subtle">
              <span className="font-semibold text-orange">{labels.howItMoves}: </span>
              {term.moves}
            </p>
          </details>
        </li>
      ))}
    </ul>
  );
}
