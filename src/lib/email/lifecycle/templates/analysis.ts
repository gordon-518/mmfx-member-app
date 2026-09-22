import { button, tracker } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, esc, greeting, p, paragraphs, preheaderOf, signoff, textOf, url } from "../copy";

// Flow A, day 1 of the 14-day trial, only if they have never opened the Daily
// Analysis. It names today's read by title and bias so the email is the thing
// itself, not an advert for it, and asks for one action: open today's analysis.

export const defaultCopy: LifecycleCopy = {
  subject: "Today's read on gold",
  preheader: "Written before the session opens. A short video, a PDF, and the levels being watched.",
  paragraphs: [
    "Every trading morning the desk writes down its read on gold before the session opens. Today's is above, with the bias it is working from.",
    "A short video and a PDF. Where price sat overnight, and the levels the desk is watching.",
    "You do not have to agree with it. Hold it against your own chart and see where the two differ.",
  ],
  ctaLabel: "Open today's analysis",
};

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = url(ctx, "/daily-analysis", "trial-analysis");
  const today = ctx.todayAnalysis;
  const words = paragraphs(copy);
  const list = tracker(ctx.onboarding, "analysis");
  const cta = button(link, copy.ctaLabel);
  const hello = greeting(ctx);
  const sign = signoff();

  const todayHtml = today
    ? `Today's is up: <b>${esc(today.title)}</b>, bias ${esc(today.bias)}.`
    : "The next one goes up before the session.";
  const todayText = today
    ? `Today's is up: ${today.title}, bias ${today.bias}.`
    : "The next one goes up before the session.";

  return {
    subject: copy.subject,
    preheader: preheaderOf(copy),
    html: [hello.html, words.html, p(todayHtml), list.html, cta.html, sign.html].join(""),
    text: textOf([hello.text, words.text, todayText, list.text, cta.text, sign.text]),
  };
}

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, defaultCopy));

export default template;
