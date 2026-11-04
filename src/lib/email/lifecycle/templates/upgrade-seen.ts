import { button, ladder as ladderStrip } from "@/lib/email/ui";
import { en } from "@/lib/email/i18n/en";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url, wordsOf } from "../copy";

// Flow C, 48 hours after someone looked at the tier page and didn't deposit.
// They're not unconvinced by the product — they're unsure what the money is.
// This email exists to answer that one question calmly. One action: go back and
// read the tiers now that the number makes sense.

export const defaultCopy: LifecycleCopy = en.lifecycle.upgradeSeen.copy;

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = url(ctx, "/upgrade", "hot-upgrade-seen");
  const words = paragraphs(copy);
  const rungs = ladderStrip(wordsOf(ctx));
  const cta = button(link, copy.ctaLabel);
  const hello = greeting(ctx);
  const sign = signoff(ctx);

  return {
    subject: copy.subject,
    preheader: preheaderOf(copy),
    html: [hello.html, words.html, rungs.html, cta.html, sign.html].join(""),
    text: textOf([hello.text, words.text, rungs.text, cta.text, sign.text]),
  };
}

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, wordsOf(ctx).lifecycle.upgradeSeen.copy));

export default template;
