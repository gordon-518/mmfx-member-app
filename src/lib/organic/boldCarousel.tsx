// The bold carousel: five slides that look different from each other.
//
// Ported from a template Gordon picked, keeping its STRUCTURE — alternating colour
// fields, alternating text alignment, a mark, and a piece of furniture in every corner —
// while using MMFX's own palette and type.
//
// Why the furniture matters: our previous carousel was five white slides carrying one
// line of copy each, and the short ones looked like failed renders. The fix is not more
// words, it is giving the frame something to hold — a wordmark, an index, a rule, a
// pill, a mark. A sparse slide then reads as composed rather than empty.
//
// Satori subset rules apply throughout: flexbox only, explicit `display` on every
// element, no transforms worth trusting. The asterisk is an inline data-URI SVG because
// that is the one vector path Satori renders predictably.
import { slideTheme, type SlideTheme, CAROUSEL_ROLES } from "./slideTheme";
import { DISPLAY, BODY } from "./renderFonts";

const PAD = 72;
const SITE = "app.marketmakersfx.net";

/** The eight-point asterisk, as a data URI so Satori rasterises it predictably. */
function markUrl(color: string): string {
  const d =
    "M37.6 1.7 29.5 21.2 49.1 13.1 51 17.3 31.3 25.4 51 33.5 49.1 37.6 29.5 29.5 " +
    "37.6 49.1 33.5 51 25.4 31.3 17.3 51 13.2 49.1 21.2 29.5 1.7 37.6 0 33.5 19.5 " +
    "25.4 0 17.3 1.7 13.2 21.2 21.2 13.2 1.7 17.3 0 25.4 19.5 33.5 0 37.6 1.7Z";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 51 51"><path d="${d}" fill="${color}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function Mark({ color, size }: { color: string; size: number }) {
  return <img src={markUrl(color)} width={size} height={size} style={{ display: "flex" }} alt="" />;
}

function Wordmark({ t }: { t: SlideTheme }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ display: "flex", width: 30, height: 30, borderRadius: 9, background: t.accent }} />
      <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 26, fontWeight: 700, color: t.ink }}>
        MarketMakersFX
      </div>
    </div>
  );
}

/** Outlined pill — "Swipe to learn", "next", the quoted line on the proof slide. */
function Pill({
  t,
  children,
  filled = false,
}: {
  t: SlideTheme;
  children: React.ReactNode;
  filled?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "16px 34px",
        borderRadius: 999,
        border: `2px solid ${filled ? "transparent" : t.ink}`,
        background: filled ? t.ink : "transparent",
        color: filled ? t.bg : t.ink,
        fontFamily: DISPLAY,
        fontWeight: 700,
        fontSize: 30,
      }}
    >
      {children}
    </div>
  );
}

function slideNumber(role: string): number {
  const i = CAROUSEL_ROLES.indexOf(role as (typeof CAROUSEL_ROLES)[number]);
  return i >= 0 ? i + 1 : 1;
}

/** Headline size shrinks as the copy grows, so a long line never overruns the frame. */
function headlineSize(text: string, base: number): number {
  const n = text.trim().length;
  if (n <= 40) return base;
  if (n <= 70) return Math.round(base * 0.82);
  if (n <= 110) return Math.round(base * 0.68);
  return Math.round(base * 0.56);
}

export function BoldCarouselSlide({
  role,
  slots,
  w,
  h,
}: {
  role: string;
  slots: Record<string, string>;
  w: number;
  h: number;
}) {
  const t = slideTheme(role);
  const text = (slots[role] ?? "").trim();
  const n = slideNumber(role);
  const isCta = role === "cta";

  // Alignment rotates across the deck — left, centre, right, left, centre. Borrowed
  // wholesale from the source template: it is what stops five slides of the same
  // typeface feeling like one slide repeated.
  const align =
    role === "context" || isCta ? "center" : role === "mechanism" ? "flex-end" : "flex-start";
  const textAlign = align === "center" ? "center" : align === "flex-end" ? "right" : "left";

  const headline = (
    <div
      style={{
        display: "flex",
        fontFamily: DISPLAY,
        fontWeight: 800,
        fontSize: headlineSize(text, isCta ? 86 : 96),
        lineHeight: 1.04,
        letterSpacing: -2,
        color: isCta ? t.ink : t.ink,
        textAlign,
      }}
    >
      {text}
    </div>
  );

  return (
    <div
      style={{
        width: w,
        height: h,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: t.bg,
        padding: PAD,
        fontFamily: BODY,
      }}
    >
      {/* top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Wordmark t={t} />
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 26, fontWeight: 700, color: t.body }}>
          {n}/5
        </div>
      </div>

      {/* body */}
      {isCta ? (
        // The closing slide puts its copy on a card, so the orange field frames it.
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 34,
            margin: "auto",
            width: "100%",
            padding: "72px 56px",
            borderRadius: 44,
            background: "#F5F4F2",
          }}
        >
          {headline}
          <Pill t={{ ...t, ink: "#141210", bg: "#F5F4F2" }} filled>
            {SITE}
          </Pill>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: align,
            gap: 36,
            margin: "auto 0",
            width: "100%",
          }}
        >
          <Mark color={t.accent} size={56} />
          {headline}
        </div>
      )}

      {/* bottom row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 26, color: t.body }}>{isCta ? "" : SITE}</div>
        {role === "hook" ? (
          <Pill t={t}>Swipe to learn</Pill>
        ) : isCta ? (
          <div style={{ display: "flex", fontFamily: DISPLAY, fontWeight: 700, fontSize: 30, color: t.ink }}>
            @marketmakersfx
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: t.body }}>
            next
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 16"><path d="M0 8h34M27 1l7 7-7 7" fill="none" stroke="${t.accent}" stroke-width="2.5"/></svg>`
              )}`}
              width={40}
              height={16}
              style={{ display: "flex" }}
              alt=""
            />
          </div>
        )}
      </div>
    </div>
  );
}
