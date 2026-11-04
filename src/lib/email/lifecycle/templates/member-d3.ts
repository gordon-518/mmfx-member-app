import { button, featureCard } from "@/lib/email/ui";
import { en } from "@/lib/email/i18n/en";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url, wordsOf } from "../copy";

// Flow D, three days after a deposit is verified at Team MM, when the AI
// Trading Assistant has not been connected. The most expensive rung has the
// one feature nobody finds on their own. One action: connect the account.

export const defaultCopy: LifecycleCopy = en.lifecycle.memberD3.copy;

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = url(ctx, "/journal", "member-d3");
  const words = paragraphs(copy);
  const card = featureCard("ai-trading-assistant", wordsOf(ctx).lifecycle.memberD3.cardName, wordsOf(ctx).lifecycle.memberD3.cardLine);
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

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, wordsOf(ctx).lifecycle.memberD3.copy));

export default template;
