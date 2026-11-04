import { button, ladder as ladderStrip, tracker } from "@/lib/email/ui";
import { en } from "@/lib/email/i18n/en";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url, wordsOf } from "../copy";

// Flow A, day 9, to everyone still on trial. The first and only time the trial
// sequence explains how access works here, stated as a map rather than an
// offer. The deposit paragraph is the point of the whole email. One action:
// read the comparison for yourself.
//
// v2: the four rungs move out of prose and into the ladder strip, which leaves
// the copy free to do the only job prose is better at — saying what the money
// actually is.

export const defaultCopy: LifecycleCopy = en.lifecycle.ladder.copy;

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = url(ctx, "/upgrade", "trial-ladder");
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

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, wordsOf(ctx).lifecycle.ladder.copy));

export default template;
