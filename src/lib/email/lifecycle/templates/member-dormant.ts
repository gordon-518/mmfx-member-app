import { button, featureCard } from "@/lib/email/ui";
import { en } from "@/lib/email/i18n/en";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url, wordsOf } from "../copy";

// Flow D, once, when a member has not opened anything for thirty days — then
// sixty days of silence regardless of what they do with it. Deliberately the
// quietest email in the set: one door, held open, no argument. One action: read
// today's analysis.

export const defaultCopy: LifecycleCopy = en.lifecycle.memberDormant.copy;

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = url(ctx, "/daily-analysis", "member-dormant");
  const words = paragraphs(copy);
  const card = featureCard("daily-analysis", wordsOf(ctx).lifecycle.memberDormant.cardName, wordsOf(ctx).lifecycle.memberDormant.cardLine);
  const cta = button(link, copy.ctaLabel);
  const hello = greeting(ctx);
  const sign = signoff(ctx);

  return {
    subject: copy.subject,
    preheader: preheaderOf(copy),
    html: [hello.html, words.html, card.html, cta.html, sign.html].join(""),
    text: textOf([hello.text, words.text, card.text, cta.text, sign.text]),
  };
}

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, wordsOf(ctx).lifecycle.memberDormant.copy));

export default template;
