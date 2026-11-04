import { button, tracker } from "@/lib/email/ui";
import { en } from "@/lib/email/i18n/en";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url, wordsOf } from "../copy";

// Flow A, day 6, only if no lesson has been finished. Nineteen lessons is a
// wall; the job of this email is to make it one lesson instead. One action:
// open the course at Foundations.

export const defaultCopy: LifecycleCopy = en.lifecycle.lesson1.copy;

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = url(ctx, "/course", "trial-lesson1");
  const words = paragraphs(copy);
  const list = tracker(ctx.onboarding, "lesson1", wordsOf(ctx));
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

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, wordsOf(ctx).lifecycle.lesson1.copy));

export default template;
