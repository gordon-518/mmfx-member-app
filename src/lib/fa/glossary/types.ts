import type { MoveKey, TermId } from "./terms";

/**
 * One term's explainer in one language.
 *
 * `moves` is either one sentence for every instrument, or — for terms whose
 * effect depends on which side of the pair the dollar sits — one per MoveKey.
 * "{asset}" in any of these is replaced with the instrument (Gold, EUR/USD…).
 */
export interface TermText {
  /** The term as the reader should see it, e.g. "DXY (US dollar index)". */
  name: string;
  /** What it is, in plain words. */
  what: string;
  /** How it typically moves the instrument. */
  moves: string | Record<MoveKey, string>;
}

/** Every term, in one language. Record<TermId, …> makes a missing term a type error. */
export type GlossaryContent = Record<TermId, TermText>;

/** A term resolved for one instrument and one language — what the UI renders. */
export interface ResolvedTerm {
  id: TermId;
  name: string;
  what: string;
  moves: string;
}

/** A run of desk text: plain words, or a recognised term. */
export type Segment = { kind: "text"; text: string } | { kind: "term"; text: string; id: TermId };
