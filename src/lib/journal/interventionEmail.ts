// Pure HTML builder for a proactive-intervention email. The branded frame now
// comes from the shared shell (src/lib/email/shell.ts) so the journal's
// coaching emails and the lifecycle rail render inside the same one; this file
// owns only the card's contents. All interpolated text is escaped.

import { emailShell, escapeHtml as esc } from "@/lib/email/shell";

export function interventionEmailHtml(p: {
  headline: string;
  body: string;
  action: string;
  ctaUrl: string;
  unsubUrl: string;
}): string {
  const bodyHtml = [
    `          <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${esc(p.headline)}</h1>`,
    `          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#3a3a3a">${esc(p.body)}</p>`,
    `          <div style="margin:0 0 22px;padding:14px 16px;background:#fff4ef;border-left:3px solid #ff5a1f;border-radius:8px;font-size:14px;line-height:1.5">`,
    `            <strong>Do this:</strong> ${esc(p.action)}`,
    `          </div>`,
    `          <a href="${esc(p.ctaUrl)}" style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:12px">Open your AI Trading Assistant</a>`,
  ].join("\n");

  return emailShell({
    bodyHtml,
    unsubUrl: p.unsubUrl,
    // The journal's own consent scope, not the marketing one.
    footerNote: "You're getting this because you track your trading with Market Makers FX.",
  });
}
