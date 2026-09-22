// Where a template's copy block sits in the frame.
//
// The render route used to bottom-anchor every copy block unconditionally
// (`marginTop: "auto"`), on the reasoning that in a feed the eye should land on the
// headline. That holds when the copy fills the lower half — the live bias-card does.
// It fails badly when the copy is short: the carousel's 5/5 slide is a single line, and
// bottom-anchoring left roughly 80% of the frame empty above it, which reads as a broken
// render rather than as minimalism.
//
// So the anchor is now a function of how much copy there actually is. Short blocks are
// centred, where the whitespace is balanced and reads as deliberate; long blocks keep the
// original bottom anchor.
//
// Satori gives us no text measurement, so height is ESTIMATED from character count. That
// is fine for this decision — it only has to be right about "short vs long", and the
// threshold sits far from where either real template lands.

/** Frame width (1080) minus its 72px padding on both sides. */
export const CONTENT_WIDTH = 1080 - 72 * 2;

/**
 * Average glyph advance as a fraction of font size, for the sans stack Satori falls back
 * to. Deliberately slightly wide: over-estimating line count biases toward bottom
 * anchoring, which is the layout that was already shipping.
 */
const CHAR_WIDTH_RATIO = 0.52;

const DEFAULT_LINE_HEIGHT = 1.2;

export type CopyRun = { text: string; fontSize: number; lineHeight?: number };

/** Anchor at or above this fraction of the available height. */
const BOTTOM_ANCHOR_THRESHOLD = 0.4;

export function estimateLines(text: string, fontSize: number, contentWidth: number): number {
  // An unfilled slot contributes nothing. Counting it as one line would inflate the
  // block and push a short card back into the bottom anchor this exists to avoid.
  if (!text.trim()) return 0;
  const charsPerLine = Math.max(1, Math.floor(contentWidth / (fontSize * CHAR_WIDTH_RATIO)));
  return Math.ceil(text.trim().length / charsPerLine);
}

export function estimateBlockHeight(
  runs: CopyRun[],
  gap: number,
  contentWidth: number
): number {
  const rendered = runs.filter((r) => r.text.trim());
  if (!rendered.length) return 0;
  const text = rendered.reduce((total, run) => {
    const lines = estimateLines(run.text, run.fontSize, contentWidth);
    return total + lines * run.fontSize * (run.lineHeight ?? DEFAULT_LINE_HEIGHT);
  }, 0);
  return text + gap * (rendered.length - 1);
}

export function anchorFor(blockHeight: number, availableHeight: number): "center" | "bottom" {
  // A frame with no room to make the choice in keeps the original behaviour.
  if (availableHeight <= 0) return "bottom";
  return blockHeight / availableHeight >= BOTTOM_ANCHOR_THRESHOLD ? "bottom" : "center";
}

/**
 * The flex properties that put a block at the chosen anchor inside `Frame`, which is a
 * column with `justifyContent: space-between`. Bottom anchoring uses `marginTop: auto` —
 * the original behaviour — and centring uses `margin: auto` so the leftover space is
 * split above and below.
 */
export function anchorStyle(anchor: "center" | "bottom"): {
  marginTop: string;
  marginBottom: number | string;
} {
  return anchor === "center"
    ? { marginTop: "auto", marginBottom: "auto" }
    : { marginTop: "auto", marginBottom: 56 };
}
