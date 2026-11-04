// Branded "Terminal Dispatch" email body for the Fundamental Desk "Send me a
// copy" flow. The thesis PDF is attached, so the body is intentionally short:
// greeting, the instrument ticker, what's inside, and the compliance line.
// Pure string builder — safe to import anywhere. In the reader's language
// (EmailMessages.fundamental); "Fundamental Desk" stays a name.

import type { Locale } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { emailMessages, riskLines } from "@/lib/email/i18n";

// Obsidian ground + single Signal-Orange accent, JetBrains-mono ticker.
const OBSIDIAN = "#0B0B0F";
const PANEL = "#141419";
const HAIRLINE = "#26262E";
const ORANGE = "#F24E12";
const INK = "#ECECEF";
const MUTE = "#8A8A95";
const MONO =
  "'JetBrains Mono','SFMono-Regular',Menlo,Consolas,monospace";
const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The subject, in the reader's language. */
export function fundamentalEmailSubject(instrumentDisplay: string, locale: Locale = "en"): string {
  return fmt(emailMessages(locale).fundamental.subject, { instrument: instrumentDisplay });
}

export function fundamentalEmailHtml(instrumentDisplay: string, locale: Locale = "en"): string {
  const ticker = esc(instrumentDisplay);
  const f = emailMessages(locale).fundamental;
  // The "not a signal" line keeps its English wording, the translation under it.
  const compliance = riskLines(locale, (m) => m.fundamental.compliance).map(esc).join("<br>");

  return `<!doctype html>
<html lang="${esc(locale)}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(f.title)}</title></head>
<body style="margin:0;padding:0;background:${OBSIDIAN};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${OBSIDIAN};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${PANEL};border:1px solid ${HAIRLINE};border-radius:16px;overflow:hidden;">

        <!-- header -->
        <tr><td style="padding:26px 32px 18px;border-bottom:1px solid ${HAIRLINE};">
          <div style="font:600 11px/1 ${MONO};letter-spacing:.22em;text-transform:uppercase;color:${ORANGE};">Market Makers FX</div>
          <div style="margin-top:6px;font:600 13px/1 ${MONO};letter-spacing:.14em;text-transform:uppercase;color:${MUTE};">${esc(f.kicker)}</div>
        </td></tr>

        <!-- ticker -->
        <tr><td style="padding:30px 32px 8px;">
          <div style="font:700 40px/1 ${MONO};letter-spacing:.02em;color:${INK};">${ticker}</div>
          <div style="margin-top:10px;height:2px;width:48px;background:${ORANGE};"></div>
        </td></tr>

        <!-- body -->
        <tr><td style="padding:18px 32px 28px;">
          <p style="margin:0 0 16px;font:400 16px/1.6 ${SANS};color:${INK};">${fmt(esc(f.attached), { instrument: `<strong style="color:${INK};">${ticker}</strong>` })}</p>
          <p style="margin:0;font:400 14px/1.65 ${SANS};color:${MUTE};">${esc(f.inside)}</p>
        </td></tr>

        <!-- compliance -->
        <tr><td style="padding:18px 32px 30px;border-top:1px solid ${HAIRLINE};">
          <p style="margin:0;font:400 12px/1.6 ${MONO};color:${MUTE};">${compliance}</p>
        </td></tr>

      </table>
      <div style="max-width:520px;margin:16px auto 0;font:400 11px/1.5 ${SANS};color:${MUTE};">${esc(f.footer)}</div>
    </td></tr>
  </table>
</body>
</html>`;
}
