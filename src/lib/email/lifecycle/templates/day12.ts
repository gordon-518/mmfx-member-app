import { button, ladder as ladderStrip, tracker } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url } from "../copy";

// Flow A, day 12 of 14, to everyone still on trial. Written to be the least
// dramatic email in the sequence: what the account loses, what it keeps, and
// nothing about time running out. One action: see what each rung opens.

export const defaultCopy: LifecycleCopy = {
  subject: "What changes on day 14",
  preheader: "What closes, what stays, and why nothing is deleted or charged.",
  paragraphs: [
    "Your trial runs to day 14. Here's the plain version of what happens then, because the vague version is how people end up surprised.",
    "What closes: the ten TradingView indicators, the strategy scripts, live classes, the Fundamental Desk, and the lessons past Module 1.",
    "What stays, with no deposit at all: the Daily Analysis every trading day, Know Your Style, Module 1 of the course, the economic calendar, the news feed and the public signals channel. Your login keeps working. Nothing is deleted and nothing is charged.",
  ],
  ctaLabel: "See what each rung opens",
};

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = url(ctx, "/upgrade", "trial-day12");
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
