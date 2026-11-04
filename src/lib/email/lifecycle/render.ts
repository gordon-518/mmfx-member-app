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

import { fmt } from "@/i18n/format";
import { emailShell } from "@/lib/email/shell";
import { riskLines } from "@/lib/email/i18n";
import { en } from "@/lib/email/i18n/en";
import { wordsOf } from "./copy";
import type { LifecycleCtx, LifecycleEmail } from "./types";

/**
 * The risk line at the foot of every marketing email. Deliberately worded
 * without any outcome vocabulary: it warns, it does not reassure. A reader in
 * another language gets this English line with their own under it.
 */
export const COMPLIANCE_LINE = en.shell.riskLine;

/** Why-am-I-getting-this, for the global marketing scope. */
export const FOOTER_NOTE = en.shell.footerNote;

/**
 * The mono label in the top-right of the black header. It is orientation, not
 * decoration: a trial reader sees where they are in fourteen days, a Free-tier
 * reader sees which desk is writing, a member sees their standing.
 */
export function contextLabelFor(ctx: LifecycleCtx): string {
  const shell = wordsOf(ctx).shell;
  if (ctx.audience === "trial") {
    const day = Math.min(Math.max(ctx.daysSinceSignup + 1, 1), 14);
    return fmt(shell.contextDay, { day: String(day).padStart(2, "0") });
  }
  if (ctx.audience === "member") return shell.contextMember;
  return shell.contextDesk;
}

/** Wrap a template's body fragment in the shell. */
export function wrapLifecycle(
  body: LifecycleEmail,
  ctx: LifecycleCtx,
  preheader?: string
): LifecycleEmail {
  const locale = ctx.locale ?? "en";
  const shell = wordsOf(ctx).shell;
  const risk = riskLines(locale, (m) => m.shell.riskLine).join("\n");
  return {
    subject: body.subject,
    html: emailShell({
      bodyHtml: `          ${body.html}`,
      unsubUrl: ctx.unsubUrl,
      preheader: preheader ?? body.preheader,
      footerNote: shell.footerNote,
      contextLabel: contextLabelFor(ctx),
      ...(body.hero ? { hero: body.hero } : {}),
      riskLine: risk,
      locale,
      unsubscribeLabel: shell.unsubscribe,
    }),
    text: `${body.text}\n\n${risk}`,
  };
}
