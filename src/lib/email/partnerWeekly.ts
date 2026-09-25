import { emailShell, escapeHtml } from "./shell";
import { fmtMoney, fmtWeek, totals, byLabel, type FunnelRow } from "@/lib/partners/funnel";

// The partner's Monday email (design 2026-09-25 §2.7). Seven days of the same
// counts the dashboard shows, on the v2 shell, so the numbers a partner
// argues from are the numbers we argue from.
//
// Deliberately plain. This goes to an agency about money, and an email about
// money that sounds excited about itself is an email nobody trusts. No
// exclamation marks, no promises, no "great week" — the numbers say whether
// it was a great week.
//
// It carries NO dashboard link with a key in it. Only the hash of a key is
// stored, so the app cannot rebuild one; the partner already holds their
// link, and mailing a live key every Monday would be a worse idea anyway.

export interface PartnerWeeklyParams {
  partnerName: string;
  since: Date;
  until: Date;
  rows: FunnelRow[];
  /** How many ads to name before the list is cut off. */
  topAds?: number;
}

export interface PartnerWeeklyEmail {
  subject: string;
  html: string;
  text: string;
}

/** The address a partner replies to when they want the report stopped. */
const STOP_MAILTO =
  "mailto:hello@marketmakersfx.net?subject=Stop%20the%20weekly%20partner%20report";

const FOOTER_NOTE =
  "You're getting this because your agency has a partner report with Market Makers FX. ";

function day(d: Date): string {
  return fmtWeek(d.toISOString().slice(0, 10));
}

function statRow(label: string, value: string): string {
  return (
    `<tr>` +
    `<td style="padding:6px 0;border-bottom:1px solid #eee;font:400 14px/1.4 Inter,Arial,sans-serif;color:#555">${escapeHtml(label)}</td>` +
    `<td align="right" style="padding:6px 0;border-bottom:1px solid #eee;font:600 14px/1.4 Inter,Arial,sans-serif;color:#1a1a1a">${escapeHtml(value)}</td>` +
    `</tr>`
  );
}

export function renderPartnerWeekly(p: PartnerWeeklyParams): PartnerWeeklyEmail {
  const t = totals(p.rows);
  const ads = byLabel(p.rows).slice(0, p.topAds ?? 5);
  const window = `${day(p.since)} to ${day(p.until)}`;

  const subject = `${p.partnerName} · funnel for ${window}`;

  const stats =
    statRow("Signups", t.signups.toLocaleString()) +
    statRow("Activated", t.activated.toLocaleString()) +
    statRow("Funded clients", t.funded.toLocaleString()) +
    statRow("Verified deposits", fmtMoney(t.depositTotal)) +
    statRow("Funded rate", `${t.fundedRate}%`);

  const adRows = ads.length
    ? ads
        .map(
          (a) =>
            `<tr>` +
            `<td style="padding:5px 0;font:400 13px/1.4 Inter,Arial,sans-serif;color:#555">${escapeHtml(a.label)}</td>` +
            `<td align="right" style="padding:5px 0;font:400 13px/1.4 Inter,Arial,sans-serif;color:#555">${a.signups} signups</td>` +
            `<td align="right" style="padding:5px 0 5px 14px;font:600 13px/1.4 Inter,Arial,sans-serif;color:#1a1a1a">${a.funded} funded</td>` +
            `</tr>`
        )
        .join("")
    : `<tr><td style="padding:5px 0;font:400 13px/1.4 Inter,Arial,sans-serif;color:#555">No tagged signups in this window.</td></tr>`;

  const bodyHtml =
    `<div style="font:700 20px/1.3 Montserrat,Arial,sans-serif;color:#1a1a1a;margin-bottom:6px">Last week's funnel</div>` +
    `<div style="font:400 14px/1.6 Inter,Arial,sans-serif;color:#555;margin-bottom:18px">${escapeHtml(window)}. Counts are verified deposits only, attributed on the last paid touch within 7 days of the deposit.</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px">${stats}</table>` +
    `<div style="font:600 13px/1.3 Inter,Arial,sans-serif;color:#1a1a1a;margin-bottom:8px">By ad</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px">${adRows}</table>` +
    `<div style="font:400 13px/1.6 Inter,Arial,sans-serif;color:#8a8f98">The full breakdown by ad and by week, and the CSV, are on your dashboard — the link you were given carries your key.</div>`;

  const textLines = [
    `Last week's funnel — ${window}`,
    "",
    `Signups: ${t.signups}`,
    `Activated: ${t.activated}`,
    `Funded clients: ${t.funded}`,
    `Verified deposits: ${fmtMoney(t.depositTotal)}`,
    `Funded rate: ${t.fundedRate}%`,
    "",
    "By ad:",
    ...(ads.length
      ? ads.map((a) => `  ${a.label} — ${a.signups} signups, ${a.funded} funded`)
      : ["  No tagged signups in this window."]),
    "",
    "Counts are verified deposits only, attributed on the last paid touch within",
    "7 days of the deposit. The full breakdown and the CSV are on your dashboard",
    "— the link you were given carries your key.",
    "",
    "Market Makers FX, Singapore",
  ];

  return {
    subject,
    html: emailShell({
      bodyHtml,
      unsubUrl: STOP_MAILTO,
      preheader: `${t.signups} signups, ${t.funded} funded`,
      footerNote: FOOTER_NOTE,
      contextLabel: "PARTNER REPORT",
    }),
    text: textLines.join("\n"),
  };
}
