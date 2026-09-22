import { button, ladder as ladderStrip, tracker } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url } from "../copy";

// Flow A, day 9, to everyone still on trial. The first and only time the trial
// sequence explains how access works here, stated as a map rather than an
// offer. The deposit paragraph is the point of the whole email. One action:
// read the comparison for yourself.
//
// v2: the four rungs move out of prose and into the ladder strip, which leaves
// the copy free to do the only job prose is better at — saying what the money
// actually is.

export const defaultCopy: LifecycleCopy = {
  subject: "What $50, $200 and $500 open",
  preheader: "A map of how access works here. No pitch attached — read it and do nothing.",
  paragraphs: [
    "Nine days in, so here's the map of how access works here. No pitch attached — you can read it and do nothing.",
    "About those numbers. They're not prices and they're not paid to Market Makers. Each one is a deposit into a trading account at a partner broker, opened in your name. You hold it, you trade with it, and you can withdraw it. Your cumulative deposit is what sets your rung, and it's a high-water mark, so a drawdown never takes your access away.",
  ],
  ctaLabel: "See the full comparison",
};

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = url(ctx, "/upgrade", "trial-ladder");
  const words = paragraphs(copy);
  const rungs = ladderStrip();
  const list = tracker(ctx.onboarding, "desk");
  const cta = button(link, copy.ctaLabel);
  const hello = greeting(ctx);
  const sign = signoff();

  return {
    subject: copy.subject,
    preheader: preheaderOf(copy),
    html: [hello.html, words.html, rungs.html, list.html, cta.html, sign.html].join(""),
    text: textOf([hello.text, words.text, rungs.text, list.text, cta.text, sign.text]),
  };
}

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, defaultCopy));

export default template;
