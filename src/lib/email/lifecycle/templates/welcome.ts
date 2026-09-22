import { button, tracker } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, esc, greeting, p, paragraphs, preheaderOf, signoff, textOf, url } from "../copy";

// Flow A, day 0, everyone on a live trial. Three jobs in order: say what
// Market Makers is, answer the question nobody asks out loud ("what's the
// catch, if it's free?"), and earn ONE action — reading today's gold bias.
// Nothing about the ladder here; day 9 does that.
//
// v2: the black display hero carries the welcome, and the tracker turns the
// fourteen days into five things rather than a countdown.

export const defaultCopy: LifecycleCopy = {
  subject: "Start with today's gold read",
  preheader: "One page on XAU/USD, worked from the daily chart. Three minutes is all it asks.",
  paragraphs: [
    "Start here: open today's Daily Analysis. One page on gold, worked top-down from the daily chart. Three minutes, and you will know how the desk is reading price this session.",
    "It publishes every trading day. This is a desk, not a course library, so the read exists for you to argue with and build your own view rather than borrow ours.",
    "Your 14-day trial is open now, and access costs you nothing. We are an introducing broker, so the broker pays us when you trade. Any deposit goes into your own account, in your name, and stays yours. After day 14, the daily read, Know Your Style and Module 1 of the course stay open.",
  ],
  ctaLabel: "Open today's analysis",
};

const BIAS: Record<string, string> = { bullish: "Bullish", bearish: "Bearish", neutral: "Neutral" };

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = url(ctx, "/daily-analysis", "trial-welcome");
  const da = ctx.todayAnalysis;
  const words = paragraphs(copy);
  const list = tracker(ctx.onboarding, "analysis");
  const cta = button(link, copy.ctaLabel);
  const hello = greeting(ctx);
  const sign = signoff();

  // Today's read is DATA, not copy: a variant rewrites the sentences around
  // it and never the desk's own headline.
  const today = da
    ? `Today's read is ${da.title}${da.bias ? ` — ${BIAS[da.bias] ?? da.bias} bias` : ""}.${da.description ? ` ${da.description}` : ""}`
    : "Today's read goes up during the Asian session. It's the first thing to check each morning.";
  const todayHtml = da
    ? `Today's read is <b>${esc(da.title)}</b>${da.bias ? ` — ${esc(BIAS[da.bias] ?? da.bias)} bias` : ""}.${da.description ? ` ${esc(da.description)}` : ""}`
    : esc(today);

  return {
    subject: copy.subject,
    preheader: preheaderOf(copy),
    hero: {
      kind: "display",
      eyebrow: "Welcome to the desk",
      headline: "READ THE MARKET.\nTHEN ACT ON IT.",
    },
    html: [hello.html, words.html, p(todayHtml), list.html, cta.html, sign.html].join(""),
    text: textOf([hello.text, words.text, today, list.text, cta.text, sign.text]),
  };
}

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, defaultCopy));

export default template;
