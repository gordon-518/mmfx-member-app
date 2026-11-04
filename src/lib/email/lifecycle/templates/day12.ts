import { button, ladder as ladderStrip, tracker } from "@/lib/email/ui";
import { en } from "@/lib/email/i18n/en";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url, wordsOf } from "../copy";

// Flow A, day 12 of 14, to everyone still on trial. Written to be the least
// dramatic email in the sequence: what the account loses, what it keeps, and
// nothing about time running out. One action: see what each rung opens.

export const defaultCopy: LifecycleCopy = en.lifecycle.day12.copy;

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = url(ctx, "/upgrade", "trial-day12");
  const words = paragraphs(copy);
  const rungs = ladderStrip(wordsOf(ctx));
  const list = tracker(ctx.onboarding, "desk", wordsOf(ctx));
  const cta = button(link, copy.ctaLabel);
  const hello = greeting(ctx);
  const sign = signoff(ctx);

  return {
    subject: copy.subject,
    preheader: preheaderOf(copy),
    html: [hello.html, words.html, rungs.html, list.html, cta.html, sign.html].join(""),
    text: textOf([hello.text, words.text, rungs.text, list.text, cta.text, sign.text]),
  };
}

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, wordsOf(ctx).lifecycle.day12.copy));

export default template;
