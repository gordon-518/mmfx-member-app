// The stat card: product numbers drawn natively, never screenshotted.
//
// marketmakersfx.net/features/* presents every product figure as a purpose-built
// HTML/CSS panel — there is not one <img> on those pages — always under the line
// "Illustrative example profile — not a member's results, not typical, and not a
// projection of yours."
//
// This template is the same idea at post size. That matters for three reasons:
// a cropped app screenshot is mostly sidebar and chrome and will not sit in a
// 1080x1350 frame; drawing the panel means it is set in the brand's type rather than
// the app's; and the figures come from the site's own published illustrative profile,
// so nothing here is invented for marketing.
//
// The disclaimer is a REQUIRED slot, enforced in the renderer. A template that can omit
// it eventually will.
import { DISPLAY, BODY } from "./renderFonts";
import { ORANGE } from "./slideTheme";

const PAPER = "#F5F4F2";
const INK = "#141210";
const SUB = "#6B645D";
const LINE = "#E4DFD8";

/** Two rows of two. More tiles than this and none of them are readable at post size. */
export const MAX_STATS = 4;

export type Stat = { label: string; value: string; sub: string; featured: boolean };

/**
 * Slots arrive as a flat string map (the template contract), so stats are read as
 * numbered triples: stat1Label / stat1Value / stat1Sub.
 */
export function readStats(slots: Record<string, string>): Stat[] {
  const feature = Number.parseInt(slots.feature ?? "", 10);
  const out: Stat[] = [];
  for (let i = 1; i <= 9 && out.length < MAX_STATS; i++) {
    const value = (slots[`stat${i}Value`] ?? "").trim();
    // A tile with no value would render as an empty box, which reads as a broken card.
    if (!value) continue;
    out.push({
      label: (slots[`stat${i}Label`] ?? "").trim(),
      value,
      sub: (slots[`stat${i}Sub`] ?? "").trim(),
      featured: i === feature,
    });
  }
  return out;
}

/** Tile width less its padding — the space a value actually has. */
const TILE_TEXT_W = 414 - 34 * 2;

/**
 * Long values step down so the tile never overruns — Satori will not do this for us.
 * Fitted to the tile's real width rather than banded by length: banding put
 * "1,238.00 USD" at a size that wrapped to two lines and left the tiles uneven.
 */
export function valueSize(value: string): number {
  const n = value.trim().length;
  if (!n) return 76;
  // 0.68, measured against what actually rendered — not guessed. Bricolage at weight
  // 800 sets digits and currency codes much wider than its average glyph, and an
  // earlier 0.54 put "-412.00 USD" at a size that still wrapped to two lines.
  return Math.max(30, Math.min(76, Math.floor(TILE_TEXT_W / (n * 0.68))));
}

const MIN_DISCLAIMER = 20;

/** Returns why the card must not render, or null when it may. */
export function disclaimerError(slots: Record<string, string>): string | null {
  const d = (slots.disclaimer ?? "").trim();
  if (d.length < MIN_DISCLAIMER) {
    return "stat-card requires a `disclaimer` slot of at least " +
      `${MIN_DISCLAIMER} characters. These are product figures; the marketing site never ` +
      "shows them without one.";
  }
  return null;
}

function Tile({ s }: { s: Stat }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 10,
        width: 414,
        height: 210,
        padding: "0 34px",
        borderRadius: 26,
        background: s.featured ? "#FFF1EA" : "#FFFFFF",
        border: `2px solid ${s.featured ? ORANGE : LINE}`,
      }}
    >
      <div style={{ display: "flex", fontSize: 24, letterSpacing: 1.5, color: SUB }}>
        {s.label}
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: DISPLAY,
          fontWeight: 800,
          fontSize: valueSize(s.value),
          color: s.featured ? "#B8350A" : INK,
          lineHeight: 1.05,
        }}
      >
        {s.value}
      </div>
      {s.sub ? <div style={{ display: "flex", fontSize: 24, color: SUB }}>{s.sub}</div> : null}
    </div>
  );
}

export function StatCard({
  slots,
  w,
  h,
}: {
  slots: Record<string, string>;
  w: number;
  h: number;
}) {
  const stats = readStats(slots);
  const rows = [stats.slice(0, 2), stats.slice(2, 4)].filter((r) => r.length);

  return (
    <div
      style={{
        width: w,
        height: h,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: PAPER,
        padding: 72,
        fontFamily: BODY,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", width: 30, height: 30, borderRadius: 9, background: ORANGE }} />
          <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 26, fontWeight: 700, color: INK }}>
            MarketMakersFX
          </div>
        </div>
        {slots.eyebrow ? (
          <div style={{ display: "flex", fontSize: 24, letterSpacing: 2, color: ORANGE, marginTop: 24 }}>
            {slots.eyebrow.toUpperCase()}
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: (slots.headline ?? "").length > 54 ? 58 : 70,
            lineHeight: 1.08,
            letterSpacing: -1.5,
            color: INK,
          }}
        >
          {slots.headline ?? ""}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22, margin: "auto 0" }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: "flex", gap: 22 }}>
            {row.map((s, j) => (
              <Tile key={j} s={s} />
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", fontSize: 22, color: SUB, lineHeight: 1.35 }}>
          {slots.disclaimer ?? ""}
        </div>
        <div
          style={{
            display: "flex",
            borderTop: `2px solid ${LINE}`,
            paddingTop: 22,
            fontSize: 26,
            color: SUB,
          }}
        >
          app.marketmakersfx.net
        </div>
      </div>
    </div>
  );
}
