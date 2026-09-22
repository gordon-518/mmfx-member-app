// The one branded HTML frame every Market Makers email renders inside.
//
// v2 (design 2026-09-22 §3, "Desk Light"): the email became the daily cover's
// little sibling — black stage for the identity, white paper for the reading,
// orange used once. What changed against v1: 600px instead of 480, a black
// header band carrying the two-circle mark and an optional mono context label,
// an optional hero (the cover image, or a black display block), and a warm-gray
// footer band holding the risk line, the consent line, the unsubscribe link and
// the postal address.
//
// Every v2 parameter is OPTIONAL. The journal's coaching emails and the deposit
// receipts render through this same function and pass none of them: they get
// the new frame for free and their own copy is untouched (design §9).
//
// Inline styles only — email clients strip <style> and external CSS. Tables,
// not flexbox, for the same reason. The Google Fonts <link> is an improvement
// for the clients that honour it (Apple Mail, iOS, Samsung) and never a
// dependency: every `font:` shorthand ends in Arial/Helvetica.
//
// `bodyHtml` is trusted, already-escaped HTML: builders compose it from
// escapeHtml()'d fragments. Everything the shell itself interpolates is
// escaped here.

import { EMAIL_ASSET_BASE } from "./ui";

/** HTML-escape a string for interpolation into an email body. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Why-am-I-getting-this line, unless the caller has a narrower one. */
export const DEFAULT_FOOTER_NOTE =
  "You're getting this because you have a Market Makers FX account.";

/** The postal identification every bulk sender's footer needs (decision §8.1:
 *  ship the minimum). */
export const POSTAL_LINE = "Market Makers FX, Singapore";

/**
 * The band under the header.
 *  - `image`  — full-bleed, normally the day's published cover PNG.
 *  - `display` — a black block: mono orange eyebrow over a Montserrat 900
 *    headline. `\n` in the headline becomes a line break; two lines, at most.
 */
export type EmailHero =
  | { kind: "image"; src: string; alt: string }
  | { kind: "display"; eyebrow: string; headline: string };

export interface EmailShellParams {
  /** Trusted HTML for the white card. */
  bodyHtml: string;
  /** The one-click unsubscribe URL. Also goes in the List-Unsubscribe header. */
  unsubUrl: string;
  /** Inbox preview text. Hidden in the body, shown next to the subject. */
  preheader?: string;
  /** Overrides the "why am I getting this" line above the unsubscribe link. */
  footerNote?: string;
  /** Right-aligned mono label in the header: `DAY 03 / 14`, `DESK · XAU/USD`. */
  contextLabel?: string;
  /** The optional band between the header and the body. */
  hero?: EmailHero;
  /** The risk line, when this email is marketing. Footer, above the consent line. */
  riskLine?: string;
}

const DISPLAY = "Montserrat,Arial,sans-serif";
const BODY = "Inter,Arial,sans-serif";
const MONO = "'JetBrains Mono',Menlo,monospace";

const FONTS =
  "https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;900&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap";

function heroRow(hero: EmailHero): string {
  if (hero.kind === "image") {
    return (
      `        <tr><td style="padding:0">` +
      `<img src="${escapeHtml(hero.src)}" alt="${escapeHtml(hero.alt)}" width="600" height="338" style="display:block;border:0;width:100%;height:auto">` +
      `</td></tr>`
    );
  }
  const headline = escapeHtml(hero.headline).replace(/\n/g, "<br>");
  return (
    `        <tr><td style="background:#000000;padding:8px 32px 34px">` +
    `<div style="font:400 11px/1 ${MONO};letter-spacing:.1em;color:#FF5A1F;text-transform:uppercase;margin-bottom:14px">${escapeHtml(hero.eyebrow)}</div>` +
    `<div style="font:900 34px/1.05 ${DISPLAY};letter-spacing:-.015em;color:#F5F5F5">${headline}</div>` +
    `</td></tr>`
  );
}

export function emailShell(p: EmailShellParams): string {
  const preheader = p.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(p.preheader)}</div>`
    : "";

  // The header band's bottom padding closes up when a display hero follows, so
  // the mark and the headline read as one black stage rather than two.
  const headerPad = p.hero?.kind === "display" ? "20px 32px 0" : "20px 32px";

  const context = p.contextLabel
    ? `<td align="right" style="font:400 11px/1 ${MONO};letter-spacing:.06em;color:#8a8f98">${escapeHtml(p.contextLabel)}</td>`
    : "";

  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<link href="${FONTS}" rel="stylesheet">
</head>
<body style="margin:0;background:#e9e6e0;font-family:Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a">${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9e6e0;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3dfd8">
        <tr><td style="background:#000000;padding:${headerPad}">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td width="30" style="padding-right:12px"><img src="${EMAIL_ASSET_BASE}/mark@2x.png" alt="Market Makers FX" width="30" height="18" style="display:block;border:0"></td>
            <td style="font:700 13px/1 ${DISPLAY};letter-spacing:.14em;color:#F5F5F5;white-space:nowrap">MARKET MAKERS FX</td>
            ${context}
          </tr></table>
        </td></tr>
${p.hero ? heroRow(p.hero) : ""}
        <tr><td style="padding:28px 32px">
${p.bodyHtml}
        </td></tr>
        <tr><td style="background:#f6f4f0;padding:18px 32px;font:400 12px/1.6 ${BODY};color:#8a8f98">
          ${p.riskLine ? `${escapeHtml(p.riskLine)}<br>` : ""}${p.footerNote ?? DEFAULT_FOOTER_NOTE}
          <a href="${escapeHtml(p.unsubUrl)}" style="color:#8a8f98">Unsubscribe</a> &middot; ${POSTAL_LINE}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
