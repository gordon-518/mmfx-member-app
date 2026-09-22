// Per-slide colour for the bold carousel.
//
// The template this is ported from works because consecutive slides do NOT look alike:
// light, then a full orange field, then black, then light again, then orange. Someone
// swiping sees the deck change under their thumb. Our previous carousel was five white
// slides in a row, which is why it read as one slide shown five times.
//
// Colours are the MMFX brand tokens, not the source template's — the point is to borrow
// its structure, not its palette.

export const CAROUSEL_ROLES = ["hook", "context", "mechanism", "proof", "cta"] as const;
export type CarouselRole = (typeof CAROUSEL_ROLES)[number];

export const ORANGE = "#FF5A1F";
// Brand orange is only 2.84:1 on the off-white field — fine as a big graphic shape is
// NOT true: that fails even WCAG's 3:1 bar for meaningful graphics, and the circled word
// is meaningful. So light slides use deepened orange: one step for marks, one more for
// anything set as text.
const ORANGE_MARK = "#D9410E";
const ORANGE_TEXT = "#C2380B";
const PAPER = "#F5F4F2";
const INK = "#141210";
const BLACK = "#0C0B0A";

export type SlideTheme = {
  /** Slide background. */
  bg: string;
  /** Headline colour. */
  ink: string;
  /** Supporting copy and furniture (page index, footer). */
  body: string;
  /** Accent for marks and rules — shapes, never text. */
  accent: string;
  /** Accent for words set in the accent colour. Darker, because text needs 4.5:1. */
  accentText: string;
  /** Whether this slide sits on a dark field, for picking the mark variants. */
  dark: boolean;
};

// On the orange field the accent cannot be orange, so it becomes ink — the mark still
// reads, just as a solid rather than a highlight.
export const SLIDE_THEMES: Record<CarouselRole, SlideTheme> = {
  hook: { bg: PAPER, ink: INK, body: "#5C5650", accent: ORANGE_MARK, accentText: ORANGE_TEXT, dark: false },
  context: { bg: ORANGE, ink: BLACK, body: "#2B1408", accent: BLACK, accentText: BLACK, dark: false },
  // On black the brand orange is 6.31:1 — it can be used at full strength for both.
  mechanism: { bg: BLACK, ink: PAPER, body: "#C9C4BE", accent: ORANGE, accentText: ORANGE, dark: true },
  proof: { bg: PAPER, ink: INK, body: "#5C5650", accent: ORANGE_MARK, accentText: ORANGE_TEXT, dark: false },
  cta: { bg: ORANGE, ink: BLACK, body: "#2B1408", accent: BLACK, accentText: BLACK, dark: false },
};

export function slideTheme(role: string): SlideTheme {
  return SLIDE_THEMES[role as CarouselRole] ?? SLIDE_THEMES.hook;
}

// --- contrast -------------------------------------------------------------------
// Kept here rather than pulled in as a dependency: it is eight lines, and the tests
// need it to assert that no theme ships an unreadable slide.

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16
  );
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
