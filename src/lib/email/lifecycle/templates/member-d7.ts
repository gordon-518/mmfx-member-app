import { button, featureCard } from "@/lib/email/ui";
import { en } from "@/lib/email/i18n/en";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url, wordsOf } from "../copy";

// Flow D, a week after a deposit is verified at Desk or above. Desk members
// find the indicators immediately and the Fundamental Desk almost never. One
// action: open it once.

export const defaultCopy: LifecycleCopy = en.lifecycle.memberD7.copy;

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = url(ctx, "/bots/fundamental", "member-d7");
  const words = paragraphs(copy);
  const card = featureCard("fundamental-desk", wordsOf(ctx).lifecycle.memberD7.cardName, wordsOf(ctx).lifecycle.memberD7.cardLine);
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

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, wordsOf(ctx).lifecycle.memberD7.copy));

export default template;
