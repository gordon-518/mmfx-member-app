// Where a template's body becomes a sendable email.
//
// A LifecycleTemplate returns a BODY FRAGMENT (copy.ts) — paragraphs and one
// call to action, nothing else. The rail is what wraps it: the branded shell
// from src/lib/email/shell.ts, the risk line, the footer and the unsubscribe
// link. Doing it here rather than in fourteen templates is what guarantees
// every lifecycle email carries an unsubscribe link, including the spotlight
// the brain wrote.

import { emailShell, escapeHtml } from "@/lib/email/shell";
import type { LifecycleCtx, LifecycleEmail } from "./types";

/**
 * The risk line at the foot of every marketing email. Deliberately worded
 * without any outcome vocabulary: it warns, it does not reassure.
 */
export const COMPLIANCE_LINE =
  "Trading involves risk, including the possible loss of capital. Nothing here is financial advice.";

/** Why-am-I-getting-this, for the global marketing scope. */
export const FOOTER_NOTE = "You're getting this because you have a Market Makers FX account.";

/** Wrap a template's body fragment in the shell, with the risk line appended. */
export function wrapLifecycle(
  body: LifecycleEmail,
  ctx: LifecycleCtx,
  preheader?: string
): LifecycleEmail {
  const bodyHtml = [
    `          ${body.html}`,
    `          <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#8a8279">${escapeHtml(COMPLIANCE_LINE)}</p>`,
  ].join("\n");

  return {
    subject: body.subject,
    html: emailShell({ bodyHtml, unsubUrl: ctx.unsubUrl, preheader, footerNote: FOOTER_NOTE }),
    text: `${body.text}\n\n${COMPLIANCE_LINE}`,
  };
}
