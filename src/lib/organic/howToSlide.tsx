// A how-to slide. The number is the hero on a step, because the reader is following a
// sequence and the thing they need first is "where am I".
import { themeForRole, stepIndex, howToSlides } from "./howTo";
import { DISPLAY, BODY } from "./renderFonts";

const PAD = 72;
const SITE = "app.marketmakersfx.net";

function markUrl(color: string): string {
  const d =
    "M37.6 1.7 29.5 21.2 49.1 13.1 51 17.3 31.3 25.4 51 33.5 49.1 37.6 29.5 29.5 " +
    "37.6 49.1 33.5 51 25.4 31.3 17.3 51 13.2 49.1 21.2 29.5 1.7 37.6 0 33.5 19.5 " +
    "25.4 0 17.3 1.7 13.2 21.2 21.2 13.2 1.7 17.3 0 25.4 19.5 33.5 0 37.6 1.7Z";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 51 51"><path d="${d}" fill="${color}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Text shrinks as it grows, so an over-long instruction never overruns the frame. */
function textSize(text: string, base: number): number {
  const n = text.trim().length;
  if (n <= 40) return base;
  if (n <= 70) return Math.round(base * 0.8);
  if (n <= 110) return Math.round(base * 0.64);
  return Math.round(base * 0.52);
}

export function HowToSlide({
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
  const t = themeForRole(role);
  // Resolve through howToSlides so the number a slide shows is its RENUMBERED
  // position — the same number the reader counts, not the slot it came from.
  const all = howToSlides(slots);
  const me = all.find((s) => s.role === role);
  const text = me?.text ?? (slots[role] ?? "").trim();
  const step = me?.step ?? stepIndex(role);
  const total = me?.totalSteps ?? 0;
  const isStep = step !== null;
  const image = me?.image ?? null;

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", width: 30, height: 30, borderRadius: 9, background: t.accent }} />
          <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 26, fontWeight: 700, color: t.ink }}>
            MarketMakersFX
          </div>
        </div>
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 26, fontWeight: 700, color: t.body }}>
          {isStep ? `STEP ${step} / ${total}` : ""}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: image ? 30 : 24,
          margin: "auto 0",
          width: "100%",
        }}
      >
        {/* With a screenshot the numeral shrinks to a chip and sits beside the caption:
            the picture is the thing being looked at, and a 200px numeral above it would
            fight for the same attention. Without one, the numeral IS the slide. */}
        {image ? (
          // Instruction left, screen right. App screenshots are tall portrait (roughly
          // 1:2), so a full-width landscape frame would crop away everything below the
          // first third. Standing the screen up beside the caption shows the whole thing
          // and uses the width that a centred phone would waste.
          <div style={{ display: "flex", alignItems: "center", gap: 40, width: "100%" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 24, width: 430 }}>
              {isStep ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 74,
                    height: 74,
                    borderRadius: 999,
                    background: t.accent,
                    color: t.bg,
                    fontFamily: DISPLAY,
                    fontWeight: 800,
                    fontSize: 38,
                  }}
                >
                  {step}
                </div>
              ) : (
                <img src={markUrl(t.accent)} width={56} height={56} style={{ display: "flex" }} alt="" />
              )}
              <div
                style={{
                  display: "flex",
                  fontFamily: DISPLAY,
                  fontWeight: 800,
                  fontSize: textSize(text, 58),
                  lineHeight: 1.08,
                  letterSpacing: -1.5,
                  color: t.ink,
                }}
              >
                {text}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                width: 466,
                height: 930,
                borderRadius: 34,
                border: `4px solid ${t.dark ? "#2A2724" : "#E4DFD8"}`,
                background: t.dark ? "#161412" : "#FFFFFF",
                overflow: "hidden",
              }}
            >
              <img
                src={image}
                width={458}
                height={922}
                style={{ display: "flex", objectFit: "cover", objectPosition: "top" }}
                alt=""
              />
            </div>
          </div>
        ) : (
          <>
            {isStep ? (
              // The numeral, large and in the accent — the reader's place in the sequence.
              <div
                style={{
                  display: "flex",
                  fontFamily: DISPLAY,
                  fontWeight: 800,
                  fontSize: 200,
                  lineHeight: 0.9,
                  letterSpacing: -8,
                  color: t.accent,
                }}
              >
                {String(step).padStart(2, "0")}
              </div>
            ) : (
              <img src={markUrl(t.accent)} width={56} height={56} style={{ display: "flex" }} alt="" />
            )}
            <div
              style={{
                display: "flex",
                fontFamily: DISPLAY,
                fontWeight: 800,
                fontSize: textSize(text, isStep ? 76 : 96),
                lineHeight: 1.06,
                letterSpacing: -2,
                color: t.ink,
              }}
            >
              {text}
            </div>
          </>
        )}

      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 26, color: t.body }}>{SITE}</div>
        <div style={{ display: "flex", fontFamily: DISPLAY, fontWeight: 700, fontSize: 28, color: t.body }}>
          {role === "cta" ? "@marketmakersfx" : role === "hook" ? "Swipe" : "next"}
        </div>
      </div>
    </div>
  );
}
