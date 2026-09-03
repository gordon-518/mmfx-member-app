// Renders a social image from a named template + slot values, using Next's built-in
// ImageResponse (Satori). Chosen over headless Chromium because the marketing brain's
// container has no browser and no C++ toolchain — this needs neither.
//
// Satori supports a SUBSET of CSS: flexbox only (no grid), every element needs an
// explicit display, no external stylesheets. These templates are authored against that
// subset deliberately rather than ported from the site's CSS and patched when they break.
//
// Brand tokens are the marketing site's live values, so a post and the landing page it
// links to look like the same brand.
//
// Copy blocks are bottom-anchored (marginTop:auto) rather than centred: in a feed the
// eye should land on the headline, and a centred block leaves dead space above it.
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const ORANGE = "#FF5A1F";
const INK = "#1A1714";
const SUB = "#79716A";
const LINE = "#ECE7E0";
const PEACH = "#FFECE2";

type Body = {
  template: string;
  slots: Record<string, string>;
  slide?: string;
  width?: number;
  height?: number;
};

const SLIDE_ROLES = ["hook", "context", "mechanism", "proof", "cta"];

function Frame({ children, w, h }: { children: React.ReactNode; w: number; h: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#FFFFFF",
        padding: 72,
        fontFamily: "sans-serif",
      }}
    >
      {children}
    </div>
  );
}

function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: ORANGE, display: "flex" }} />
      <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: INK }}>
        MarketMakersFX
      </div>
    </div>
  );
}

function Footer({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        borderTop: `2px solid ${LINE}`,
        paddingTop: 24,
        fontSize: 26,
        color: SUB,
      }}
    >
      {text}
    </div>
  );
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const body = (await req.json()) as Body;
  const w = body.width ?? 1080;
  const h = body.height ?? 1350;
  const s = body.slots ?? {};

  let content: React.ReactNode;

  if (body.template === "bias-card") {
    content = (
      <Frame w={w} h={h}>
        <Wordmark />
        <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: "auto", marginBottom: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: SUB }}>
              {s.instrument ?? ""}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 26,
                fontWeight: 700,
                color: "#FFFFFF",
                background: ORANGE,
                padding: "8px 20px",
                borderRadius: 999,
              }}
            >
              {(s.bias ?? "").toUpperCase()}
            </div>
          </div>
          <div
            style={{ display: "flex", fontSize: 78, fontWeight: 700, color: INK, lineHeight: 1.08 }}
          >
            {s.headline ?? ""}
          </div>
          <div style={{ display: "flex", fontSize: 34, color: SUB, lineHeight: 1.35 }}>
            {s.context ?? ""}
          </div>
        </div>
        <Footer text="app.marketmakersfx.net" />
      </Frame>
    );
  } else if (body.template === "calendar-card") {
    content = (
      <Frame w={w} h={h}>
        <Wordmark />
        <div style={{ display: "flex", flexDirection: "column", gap: 26, marginTop: "auto", marginBottom: 56 }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              fontSize: 24,
              fontWeight: 700,
              color: ORANGE,
              background: PEACH,
              padding: "10px 22px",
              borderRadius: 999,
            }}
          >
            {s.when ?? ""}
          </div>
          <div
            style={{ display: "flex", fontSize: 72, fontWeight: 700, color: INK, lineHeight: 1.1 }}
          >
            {s.headline ?? ""}
          </div>
          <div style={{ display: "flex", fontSize: 38, fontWeight: 700, color: SUB }}>
            {s.event ?? ""}
          </div>
          <div style={{ display: "flex", fontSize: 32, color: SUB, lineHeight: 1.35 }}>
            {s.context ?? ""}
          </div>
        </div>
        <Footer text="Economic calendar, in the app" />
      </Frame>
    );
  } else if (body.template === "quote-card") {
    content = (
      <Frame w={w} h={h}>
        <Wordmark />
        <div style={{ display: "flex", flexDirection: "column", gap: 30, marginTop: "auto", marginBottom: 56 }}>
          <div
            style={{ display: "flex", fontSize: 66, fontWeight: 700, color: INK, lineHeight: 1.15 }}
          >
            {s.quote ?? ""}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: ORANGE, fontWeight: 700 }}>
            {s.attribution ?? ""}
          </div>
        </div>
        <Footer text="app.marketmakersfx.net" />
      </Frame>
    );
  } else if (body.template === "lesson-carousel") {
    // One slide per request; the caller loops the five roles.
    const role = body.slide ?? "hook";
    const index = SLIDE_ROLES.indexOf(role) + 1;
    content = (
      <Frame w={w} h={h}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Wordmark />
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: SUB }}>
            {index}/5
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            marginBottom: 56,
            fontSize: role === "hook" ? 78 : 54,
            fontWeight: 700,
            color: role === "cta" ? ORANGE : INK,
            lineHeight: 1.15,
          }}
        >
          {s[role] ?? ""}
        </div>
        <Footer text={role === "cta" ? "app.marketmakersfx.net" : "Swipe"} />
      </Frame>
    );
  } else {
    return new Response(JSON.stringify({ error: `unknown template: ${body.template}` }), {
      status: 400,
    });
  }

  return new ImageResponse(content, { width: w, height: h });
}
