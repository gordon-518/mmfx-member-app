// Where a template's body becomes a sendable email.
//
// A LifecycleTemplate returns a BODY FRAGMENT (copy.ts) — paragraphs, one
// module and one button, nothing else. The rail is what wraps it: the branded
// shell from src/lib/email/shell.ts, the context label, the risk line, the
// footer and the unsubscribe link. Doing it here rather than in fourteen
// templates is what guarantees every lifecycle email carries an unsubscribe
// link, including the spotlight the brain wrote.
//
// v2 moved the risk line OUT of the body and into the footer band, where it
// sits with the consent line and the postal address — it is a disclosure, not
// a paragraph, and the reader should not have to walk past it to reach the
// signature.

import { emailShell } from "@/lib/email/shell";
import type { LifecycleCtx, LifecycleEmail } from "./types";

/**
 * The risk line at the foot of every marketing email. Deliberately worded
 * without any outcome vocabulary: it warns, it does not reassure.
 */
export const COMPLIANCE_LINE =
  "Trading involves risk, including the possible loss of capital. Nothing here is financial advice.";

/** Why-am-I-getting-this, for the global marketing scope. */
export const FOOTER_NOTE = "You're getting this because you have a Market Makers FX account.";

/**
 * The mono label in the top-right of the black header. It is orientation, not
 * decoration: a trial reader sees where they are in fourteen days, a Free-tier
 * reader sees which desk is writing, a member sees their standing.
 */
export function contextLabelFor(ctx: LifecycleCtx): string {
  if (ctx.audience === "trial") {
    const day = Math.min(Math.max(ctx.daysSinceSignup + 1, 1), 14);
    return `DAY ${String(day).padStart(2, "0")} / 14`;
  }
  if (ctx.audience === "member") return "MEMBER";
  return "DESK · XAU/USD";
}

/** Wrap a template's body fragment in the shell. */
export function wrapLifecycle(
  body: LifecycleEmail,
  ctx: LifecycleCtx,
  preheader?: string
): LifecycleEmail {
  return {
    subject: body.subject,
    html: emailShell({
      bodyHtml: `          ${body.html}`,
      unsubUrl: ctx.unsubUrl,
      preheader: preheader ?? body.preheader,
      footerNote: FOOTER_NOTE,
      contextLabel: contextLabelFor(ctx),
      ...(body.hero ? { hero: body.hero } : {}),
      riskLine: COMPLIANCE_LINE,
    }),
    text: `${body.text}\n\n${COMPLIANCE_LINE}`,
  };
}
