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
  subject: "The ladder, and what each rung opens",
  preheader: "Free keeps Daily Analysis forever. The amounts are deposits into your own account.",
  paragraphs: [
    "Nine days in. Here is the map of how access works here. No pitch attached: read it and do nothing.",
    "The amounts are not prices and are not paid to Market Makers. Each is a deposit into a trading account at a partner broker, opened in your name. You hold it, you trade with it, and you can withdraw it.",
    "Your cumulative deposit sets your rung, and it is a high-water mark, so a drawdown never removes access. Free keeps Daily Analysis, Know Your Style, the calendar and Module 1 with no deposit at all.",
  ],
  ctaLabel: "See what each rung opens",
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
