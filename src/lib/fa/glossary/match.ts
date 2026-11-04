// Finding the desk's jargon inside its own sentences, and working out which
// way a term moves a given instrument. Pure: no language content here, so the
// client never has to download every explainer to underline a word.

import type { AssetClass, DeskInstrument } from "../types";
import { TERMS, TERM_IDS, type MoveKey, type TermId } from "./terms";
import type { GlossaryContent, ResolvedTerm, Segment } from "./types";

interface Hit {
  start: number;
  end: number;
  id: TermId;
}

function inScope(id: TermId, assetClass: AssetClass): boolean {
  const scope = TERMS[id].scope;
  return !scope || scope.includes(assetClass);
}

/** Every pattern hit in `text`, for terms that apply to this asset class. */
function hits(text: string, assetClass: AssetClass): Hit[] {
  const found: Hit[] = [];
  for (const id of TERM_IDS) {
    if (!inScope(id, assetClass)) continue;
    for (const pattern of TERMS[id].patterns) {
      const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
      for (const m of text.matchAll(re)) {
        if (m.index === undefined || m[0].length === 0) continue;
        found.push({ start: m.index, end: m.index + m[0].length, id });
      }
    }
  }
  return found;
}

/**
 * Split `text` into plain runs and term runs. Overlaps resolve to the earliest
 * start, then the longest match ("US 10y real yield" beats "10y"). Each term is
 * marked once per text — the first time it appears — so a sentence that says
 * "EMA" four times isn't four underlines.
 */
export function segment(text: string, assetClass: AssetClass): Segment[] {
  const chosen: Hit[] = [];
  const seen = new Set<TermId>();
  const ordered = hits(text, assetClass).sort((a, b) => a.start - b.start || b.end - a.end);
  let cursor = 0;
  for (const h of ordered) {
    if (h.start < cursor) continue; // overlaps a term already taken
    if (seen.has(h.id)) continue;
    chosen.push(h);
    seen.add(h.id);
    cursor = h.end;
  }

  const out: Segment[] = [];
  let at = 0;
  for (const h of chosen) {
    if (h.start > at) out.push({ kind: "text", text: text.slice(at, h.start) });
    out.push({ kind: "term", text: text.slice(h.start, h.end), id: h.id });
    at = h.end;
  }
  if (at < text.length) out.push({ kind: "text", text: text.slice(at) });
  return out;
}

/** The distinct terms across several texts, in the order a reader meets them. */
export function termsIn(texts: readonly string[], assetClass: AssetClass): TermId[] {
  const ids: TermId[] = [];
  for (const text of texts) {
    for (const s of segment(text, assetClass)) {
      if (s.kind === "term" && !ids.includes(s.id)) ids.push(s.id);
    }
  }
  return ids;
}

/** Which side of the pair the dollar sits on decides which way a dollar move pushes it. */
export function moveKeyFor(instrument: Pick<DeskInstrument, "id" | "assetClass">): MoveKey {
  if (instrument.assetClass === "metal") return "metal";
  if (instrument.assetClass === "crypto") return "crypto";
  return instrument.id.startsWith("USD") ? "fxUsdBase" : "fxUsdQuote";
}

/**
 * How an explainer names the instrument mid-sentence: "Gold" and "Bitcoin"
 * read naturally, but for FX the pair itself ("EUR/USD") is clearer than its
 * trading nickname ("Fiber", "Loonie"), which a newcomer won't know.
 */
export function assetName(instrument: Pick<DeskInstrument, "display" | "assetClass">, nickname: string): string {
  return instrument.assetClass === "fx_major" ? instrument.display : nickname;
}

/**
 * One term's explainer for one instrument. `asset` is how the instrument is
 * named in a sentence (the nickname for gold or bitcoin, the pair for FX).
 */
export function resolveTerm(
  content: GlossaryContent,
  id: TermId,
  instrument: Pick<DeskInstrument, "id" | "assetClass">,
  asset: string
): ResolvedTerm {
  const text = content[id];
  const moves = typeof text.moves === "string" ? text.moves : text.moves[moveKeyFor(instrument)];
  const fill = (s: string) => s.replaceAll("{asset}", asset);
  return { id, name: text.name, what: fill(text.what), moves: fill(moves) };
}
