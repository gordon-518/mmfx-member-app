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
  subject: "Welcome in — start with today's gold read",
  preheader: "What Market Makers is, why it costs you nothing, and the one thing to read first.",
  paragraphs: [
    "Market Makers is a trading desk, not a course library. Every trading day we publish one read on gold — XAU/USD — worked top-down from the daily chart, and everything around it exists so you can build your own view rather than borrow ours.",
    "How it stays free: we're an introducing broker. When you trade through a broker we're partnered with, the broker pays us. You never pay Market Makers for access, and any deposit you make is yours — in your name, at the broker, and yours to withdraw.",
    "Your 14-day trial is open now: the daily read, Know Your Style, the economic calendar, live news and the MM System course. After day 14 the account stays — Daily Analysis, Know Your Style, the calendar, news and Module 1 of the course are yours either way.",
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
