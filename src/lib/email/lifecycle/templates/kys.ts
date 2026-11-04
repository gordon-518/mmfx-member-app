import { button, tracker } from "@/lib/email/ui";
import { en } from "@/lib/email/i18n/en";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url, wordsOf } from "../copy";

// Flow A, day 2, only if Know Your Style is still unanswered. The cheapest step
// in the whole app and the one that makes everything after it personal. One
// action: answer the questions.

export const defaultCopy: LifecycleCopy = en.lifecycle.kys.copy;

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = url(ctx, "/bots/know-your-style", "trial-kys");
  const words = paragraphs(copy);
  const list = tracker(ctx.onboarding, "kys", wordsOf(ctx));
  const cta = button(link, copy.ctaLabel);
  const hello = greeting(ctx);
  const sign = signoff(ctx);

  return {
    subject: copy.subject,
    preheader: preheaderOf(copy),
    html: [hello.html, words.html, list.html, cta.html, sign.html].join(""),
    text: textOf([hello.text, words.text, list.text, cta.text, sign.text]),
  };
}

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, wordsOf(ctx).lifecycle.kys.copy));

export default template;
