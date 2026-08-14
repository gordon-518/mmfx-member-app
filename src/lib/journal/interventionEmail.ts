// Pure HTML builder for a proactive-intervention email. Inline styles only
// (email clients strip <style>/external CSS); all interpolated text is escaped.

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function interventionEmailHtml(p: {
  headline: string;
  body: string;
  action: string;
  ctaUrl: string;
  unsubUrl: string;
}): string {
  return `<!doctype html>
<html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eceef1">
        <tr><td style="background:#0a0a0a;padding:18px 28px">
          <span style="color:#ff5a1f;font-weight:700;font-size:15px;letter-spacing:.3px">MARKET MAKERS FX</span>
        </td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${esc(p.headline)}</h1>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#3a3a3a">${esc(p.body)}</p>
          <div style="margin:0 0 22px;padding:14px 16px;background:#fff4ef;border-left:3px solid #ff5a1f;border-radius:8px;font-size:14px;line-height:1.5">
            <strong>Do this:</strong> ${esc(p.action)}
          </div>
          <a href="${esc(p.ctaUrl)}" style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:12px">Open your AI Trading Assistant</a>
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #eceef1;font-size:12px;color:#8a8f98">
          You're getting this because you track your trading with Market Makers FX.
          <a href="${esc(p.unsubUrl)}" style="color:#8a8f98">Unsubscribe</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
