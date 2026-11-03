import { fmt } from "./format";
import type { Messages } from "./messages/types";

/**
 * A rail card's title and blurb in the reader's language. Keyed by the card's
 * code id (rails.ts), never by its English text. Two blurbs carry a count —
 * the indicators and the course — passed in from the real content so the
 * number can't drift from what the member finds on the page.
 */
export function railCardText(
  t: Messages,
  key: string,
  counts: { indicators: number; lessons: number }
): { title: string; blurb: string } {
  const card = (t.rails.cards as Record<string, { title: string; blurb: string } | undefined>)[key];
  if (!card) return { title: key, blurb: "" };
  const n = key === "course" ? counts.lessons : counts.indicators;
  return { title: card.title, blurb: fmt(card.blurb, { n }) };
}

/** A stage's label and tagline. */
export function railStageText(t: Messages, n: number): { label: string; tagline: string } {
  const stage = (t.rails.stages as Record<string, { label: string; tagline: string } | undefined>)[`s${n}`];
  return stage ?? { label: "", tagline: "" };
}
