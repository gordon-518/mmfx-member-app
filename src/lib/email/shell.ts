// The one branded HTML shell every Market Makers email renders inside.
//
// Extracted verbatim from journal/interventionEmail.ts (which was the only
// place it lived) so the lifecycle rail and the journal's coaching emails
// can't drift apart. Inline styles only — email clients strip <style> and
// external CSS. Tables, not flexbox, for the same reason.
//
// `bodyHtml` is trusted, already-escaped HTML: builders compose it from
// escapeHtml()'d fragments. Everything the shell itself interpolates is
// escaped here.

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

export interface EmailShellParams {
  /** Trusted HTML for the white card. Indent lines by 10 spaces to match. */
  bodyHtml: string;
  /** The one-click unsubscribe URL. Also goes in the List-Unsubscribe header. */
  unsubUrl: string;
  /** Inbox preview text. Hidden in the body, shown next to the subject. */
  preheader?: string;
  /** Overrides the "why am I getting this" line above the unsubscribe link. */
  footerNote?: string;
}

export function emailShell(p: EmailShellParams): string {
  const preheader = p.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(p.preheader)}</div>`
    : "";
  return `<!doctype html>
<html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a">${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eceef1">
        <tr><td style="background:#0a0a0a;padding:18px 28px">
          <span style="color:#ff5a1f;font-weight:700;font-size:15px;letter-spacing:.3px">MARKET MAKERS FX</span>
        </td></tr>
        <tr><td style="padding:28px">
${p.bodyHtml}
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #eceef1;font-size:12px;color:#8a8f98">
          ${p.footerNote ?? DEFAULT_FOOTER_NOTE}
          <a href="${escapeHtml(p.unsubUrl)}" style="color:#8a8f98">Unsubscribe</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
