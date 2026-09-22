// The "Desk Light" component set: the modules the v2 lifecycle emails are
// built from (design 2026-09-22 §3).
//
// Every export is a pure function returning BOTH renderings — `{ html, text }`
// — because an email that looks right and reads as gibberish in plain text is
// half an email, and the twin is the first thing that rots when the two are
// written in different places.
//
// House rules, all of them forced by email clients rather than taste:
//   - tables and inline styles only; <style> blocks and flexbox are stripped
//   - every <img> carries alt, width, height, display:block and border:0, so a
//     blocked image degrades to its alt text instead of a blue-bordered gap
//   - fonts are a `font:` shorthand with Arial/Helvetica last, so the Google
//     Fonts <link> in the shell is an improvement and never a dependency
//   - one accent colour, used once per email
//
// This module deliberately does NOT import from ./shell: shell.ts imports
// EMAIL_ASSET_BASE from here, and a one-way edge is worth four duplicated
// lines of escaping.

/** Where the icon set lives. Versioned, so a redesign never breaks an email
 *  already sitting in someone's inbox (design §3, "Icon set"). */
export const EMAIL_ASSET_BASE = (
  process.env.EMAIL_ASSET_BASE?.trim() || "https://marketmakersfx.net/email/v1"
).replace(/\/+$/, "");

/** Both renderings of one module. */
export interface EmailPart {
  html: string;
  text: string;
}

export type Bias = "bullish" | "bearish" | "neutral";

// --- palette ---------------------------------------------------------------
// Brand bible v3, as used on the daily cover.
export const ORANGE = "#FF5A1F";
export const BEARISH = "#9CA3AF"; // never red — the candle rule
export const BLACK = "#000000";
export const INK = "#0a0a0a";
export const BODY_INK = "#2b2926";
export const MUTED = "#6b665e";
export const FAINT = "#8a8f98";
export const RING = "#c9c4bb";
export const DIM = "#a39d93";
export const PAPER = "#ffffff";
export const NEAR_WHITE = "#F5F5F5";
export const BORDER = "#e3dfd8";
export const FOOTER_BG = "#f6f4f0";
export const STAGE = "#e9e6e0";

// --- type ------------------------------------------------------------------
export const DISPLAY = "Montserrat,Arial,sans-serif";
export const BODY = "Inter,Arial,sans-serif";
export const MONO = "'JetBrains Mono',Menlo,monospace";

/** HTML-escape, byte-identical to shell.ts and copy.ts. Duplicated on
 *  purpose — see the header note about the one-way import edge. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** One `<img>` with every attribute a mail client needs to behave. */
export function img(src: string, alt: string, width: number, height: number, extra = ""): string {
  return `<img src="${esc(src)}" alt="${esc(alt)}" width="${width}" height="${height}" style="display:block;border:0;${extra}">`;
}

/** A body paragraph. `inner` is trusted HTML — escape interpolations first. */
export function paragraph(inner: string, margin = "0 0 14px"): string {
  return `<p style="margin:${margin};font:400 15px/1.65 ${BODY};color:${BODY_INK}">${inner}</p>`;
}

/** The display headline inside the white card, where an email has one. */
export function headline(text: string): string {
  return `<h1 style="margin:0 0 12px;font:900 26px/1.15 ${DISPLAY};letter-spacing:-.01em;color:${INK}">${esc(text)}</h1>`;
}

/** A small uppercase mono label — dates, section kickers. */
export function monoLabel(text: string, color = MUTED): string {
  return `<span style="font:400 11px/1 ${MONO};letter-spacing:.08em;color:${color};text-transform:uppercase">${esc(text)}</span>`;
}

// --- biasBadge -------------------------------------------------------------

const BIAS_WORD: Record<Bias, string> = {
  bullish: "Bullish",
  bearish: "Bearish",
  neutral: "Neutral",
};

/**
 * The bias pill. Orange for bullish, gray for bearish, outlined ink for
 * neutral — the same rule the daily cover's candles follow, and the reason
 * there is never a green or a red anywhere in a Market Makers email.
 */
export function biasBadge(bias: Bias): EmailPart {
  const word = BIAS_WORD[bias];
  const skin =
    bias === "bullish"
      ? `color:${PAPER};background:${ORANGE}`
      : bias === "bearish"
        ? `color:${PAPER};background:${BEARISH}`
        : `color:${BODY_INK};border:1px solid ${RING}`;
  return {
    html: `<span style="display:inline-block;font:700 11px/1 ${DISPLAY};letter-spacing:.1em;border-radius:999px;padding:6px 10px;${skin}">${word.toUpperCase()}</span>`,
    text: `Bias: ${word}`,
  };
}

// --- button ----------------------------------------------------------------

/**
 * The one call to action. A solid orange 48px cell, plus the VML twin Outlook
 * needs (Word's renderer ignores padding on an <a>, so without it the button
 * collapses to underlined text). The two are mutually exclusive: the VML is
 * inside `[if mso]`, the anchor inside `[if !mso]`, so no client shows both.
 */
export function button(href: string, label: string): EmailPart {
  const h = esc(href);
  const l = esc(label);
  return {
    html:
      `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px"><tr>` +
      `<td style="background:${ORANGE};border-radius:10px">` +
      `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${h}" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="21%" stroke="f" fillcolor="${ORANGE}">` +
      `<w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold">${l}</center>` +
      `</v:roundrect><![endif]-->` +
      `<!--[if !mso]><!--><a href="${h}" style="display:inline-block;padding:14px 22px;font:600 15px/1 ${BODY};color:${PAPER};text-decoration:none">${l}&nbsp;&rarr;</a><!--<![endif]-->` +
      `</td></tr></table>`,
    text: `${label}: ${href}`,
  };
}

// --- tracker ---------------------------------------------------------------

export type TrackerKey = "analysis" | "kys" | "tv" | "lesson1" | "desk";

export interface TrackerState {
  tv: boolean;
  analysis: boolean;
  kys: boolean;
  lesson1: boolean;
  desk: boolean;
}

/** The five steps, in the order the trial asks for them (design 2026-09-21 §3A). */
const STEPS: { key: TrackerKey; label: string; day: number }[] = [
  { key: "analysis", label: "Read today's Daily Analysis", day: 1 },
  { key: "kys", label: "Know Your Style — 3 minutes", day: 2 },
  { key: "tv", label: "Connect TradingView", day: 4 },
  { key: "lesson1", label: "Lesson 1 — Golden Mindset", day: 6 },
  { key: "desk", label: "See what each tier opens", day: 9 },
];

/**
 * "Your first 14 days" — the one module built for behaviour rather than for
 * information. 825 of 1,000 sampled trials did zero onboarding steps; a list
 * with one thing ticked is a list people finish, and it lets every trial email
 * show progress instead of nagging about the step it was sent for.
 */
export function tracker(state: TrackerState, current: TrackerKey | null): EmailPart {
  const rows = STEPS.map((s) => {
    const done = state[s.key];
    const isCurrent = !done && s.key === current;
    const icon = done
      ? img(`${EMAIL_ASSET_BASE}/check@2x.png`, "Done", 20, 20)
      : img(`${EMAIL_ASSET_BASE}/ring@2x.png`, "Not done yet", 20, 20);
    const labelStyle = isCurrent
      ? `font:500 14px/1.4 ${BODY};color:${INK}`
      : done
        ? `font:400 14px/1.4 ${BODY};color:${MUTED}`
        : `font:400 14px/1.4 ${BODY};color:${MUTED}`;
    const right = isCurrent
      ? `<span style="font:400 11px/1 ${MONO};color:${ORANGE}">TODAY</span>`
      : `<span style="font:400 11px/1 ${MONO};color:${DIM}">DAY ${s.day}</span>`;
    return (
      `<tr><td width="28" style="padding:7px 0">${icon}</td>` +
      `<td style="padding:7px 0;${labelStyle}">${esc(s.label)}</td>` +
      `<td align="right" style="padding:7px 0">${right}</td></tr>`
    );
  }).join("");

  const text = [
    "Your first 14 days:",
    ...STEPS.map((s) => `[${state[s.key] ? "x" : " "}] ${s.label} (day ${s.day})`),
  ].join("\n");

  return {
    html:
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:12px">` +
      `<tr><td style="padding:16px 18px 6px;font:700 11px/1 ${DISPLAY};letter-spacing:.12em;color:${MUTED}">YOUR FIRST 14 DAYS</td></tr>` +
      `<tr><td style="padding:4px 18px 14px">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>` +
      `</td></tr></table>`,
    text,
  };
}

// --- featureCard -----------------------------------------------------------

/** The twelve icon slugs Part A ships (plan §0.1). */
export type IconSlug =
  | "daily-analysis"
  | "know-your-style"
  | "tradingview"
  | "course"
  | "library"
  | "indicators"
  | "live-classes"
  | "fundamental-desk"
  | "ai-trading-assistant"
  | "team-mm"
  | "signals"
  | "calendar";

/** One feature: its tile, its name, and the single line that says what it is. */
export function featureCard(icon: IconSlug, name: string, line: string): EmailPart {
  return {
    html:
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:12px"><tr>` +
      `<td width="48" valign="top" style="padding:16px 0 16px 18px">${img(`${EMAIL_ASSET_BASE}/icon-${icon}@2x.png`, name, 48, 48)}</td>` +
      `<td valign="top" style="padding:16px 18px">` +
      `<div style="font:700 15px/1.3 ${DISPLAY};color:${INK};margin:0 0 4px">${esc(name)}</div>` +
      `<div style="font:400 14px/1.5 ${BODY};color:${MUTED}">${esc(line)}</div>` +
      `</td></tr></table>`,
    text: `${name} — ${line}`,
  };
}

// --- ladder ----------------------------------------------------------------

/** The four rungs. Copy lock: "deposit into your own account", never "fee". */
const RUNGS: { name: string; amount: string; line: string }[] = [
  { name: "Free", amount: "no deposit", line: "Daily Analysis, Know Your Style, calendar, news, Module 1" },
  { name: "Foundation", amount: "$50", line: "the full course and the MM Library" },
  { name: "Desk", amount: "$200", line: "indicators, strategies, live classes, Fundamental Desk" },
  { name: "Team MM", amount: "$500", line: "the Team MM channel and the AI Trading Assistant" },
];

const LADDER_NOTE =
  "Each figure is a deposit into your own account at a partner broker, in your name and yours to withdraw.";

/**
 * The four-rung strip. Stated as a map, never as an offer: no pressure words,
 * and the note below it is the sentence the whole ladder rests on.
 */
export function ladder(): EmailPart {
  const cells = RUNGS.map(
    (r) =>
      `<td width="25%" valign="top" style="padding:16px 12px;border-left:1px solid ${BORDER}">` +
      `<div style="font:700 13px/1.2 ${DISPLAY};color:${INK}">${esc(r.name)}</div>` +
      `<div style="font:400 11px/1.4 ${MONO};color:${ORANGE};padding:4px 0 6px">${esc(r.amount)}</div>` +
      `<div style="font:400 12px/1.45 ${BODY};color:${MUTED}">${esc(r.line)}</div>` +
      `</td>`
  ).join("");

  return {
    html:
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-right:0;border-radius:12px">` +
      `<tr>${cells}</tr></table>` +
      `<p style="margin:10px 0 0;font:400 12px/1.6 ${BODY};color:${MUTED}">${esc(LADDER_NOTE)}</p>`,
    text: [
      ...RUNGS.map((r) => `- ${r.name} (${r.amount}): ${r.line}`),
      LADDER_NOTE,
    ].join("\n"),
  };
}

// --- analysisCard ----------------------------------------------------------

export interface AnalysisCardParams {
  title: string;
  bias: Bias | null;
  description: string | null;
  href: string;
  ctaLabel: string;
  /** Mono date kicker, e.g. "Tuesday · 22 Sep 2026". */
  dateLabel?: string;
  /** The published cover PNG, when the desk has one for today. */
  coverUrl?: string | null;
}

/**
 * The daily read, as a card. This IS the digest — the Free tier's own feature
 * mailed to them, not an advert for it — so the cover, the bias and the desk's
 * own line do the work and the card carries the email's single button.
 */
export function analysisCard(p: AnalysisCardParams): EmailPart {
  const badge = p.bias ? biasBadge(p.bias) : null;
  const cta = button(p.href, p.ctaLabel);

  const kicker =
    p.dateLabel || badge
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px"><tr>` +
        (p.dateLabel ? `<td>${monoLabel(p.dateLabel)}</td>` : "") +
        (badge ? `<td style="padding-left:${p.dateLabel ? "12px" : "0"}">${badge.html}</td>` : "") +
        `</tr></table>`
      : "";

  return {
    html:
      (p.coverUrl
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td>${img(p.coverUrl, p.title, 536, 302, "width:100%;height:auto;border-radius:12px")}</td></tr></table>`
        : "") +
      kicker +
      headline(p.title) +
      (p.description ? paragraph(esc(p.description), "0 0 4px") : "") +
      cta.html,
    text: [
      p.dateLabel ?? "",
      p.title,
      badge?.text ?? "",
      p.description ?? "",
      "",
      cta.text,
    ]
      .filter((l, i, a) => l.length > 0 || (i > 0 && a[i - 1].length > 0))
      .join("\n")
      .trim(),
  };
}

// --- quote -----------------------------------------------------------------

/** The Sifu line. One per email at most, and most emails have none. */
export function quote(line: string): EmailPart {
  return {
    html:
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px"><tr>` +
      `<td style="border-left:3px solid ${ORANGE};padding:2px 0 2px 16px;font:700 17px/1.45 ${DISPLAY};color:${INK}">${esc(line)}</td>` +
      `</tr></table>`,
    text: line,
  };
}
