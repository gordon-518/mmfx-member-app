import { button, tracker } from "@/lib/email/ui";
import { en } from "@/lib/email/i18n/en";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url, wordsOf } from "../copy";

// Flow A, day 4, only if no TradingView username is saved. The indicators are
// already included in the trial but can't reach anyone's charts until the desk
// knows which TradingView account to grant. One action: save the username.

export const defaultCopy: LifecycleCopy = en.lifecycle.tv.copy;

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = url(ctx, "/indicators", "trial-tv");
  const words = paragraphs(copy);
  const list = tracker(ctx.onboarding, "tv", wordsOf(ctx));
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

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, wordsOf(ctx).lifecycle.tv.copy));

export default template;
