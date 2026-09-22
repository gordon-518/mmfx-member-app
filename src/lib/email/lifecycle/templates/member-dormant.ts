import { button, featureCard } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url } from "../copy";

// Flow D, once, when a member has not opened anything for thirty days — then
// sixty days of silence regardless of what they do with it. Deliberately the
// quietest email in the set: one door, held open, no argument. One action: read
// today's analysis.

export const defaultCopy: LifecycleCopy = {
  subject: "It's been a while",
  preheader: "No pitch in this one. The desk has kept writing; the door is still open.",
  paragraphs: [
    "Your account has been quiet for about a month. No pitch in this one — life happens, and markets are easier to walk away from than to come back to.",
    "The desk has kept doing the same thing every trading morning: its read on gold. Where price sat overnight, the levels it's watching, and the bias it's working from — a short video and a PDF, before the session opens.",
    "That's the easiest way back in, and it's already on your account. Start there rather than trying to catch up on everything at once. And if Market Makers isn't for you any more, unsubscribe below and we'll leave you alone.",
  ],
  ctaLabel: "See today's read on gold",
};

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = url(ctx, "/daily-analysis", "member-dormant");
  const words = paragraphs(copy);
  const card = featureCard(
    "daily-analysis",
    "Daily Analysis",
    "The desk's read on gold, every trading morning."
  );
  const cta = button(link, copy.ctaLabel);
  const hello = greeting(ctx);
  const sign = signoff();

  return {
    subject: copy.subject,
    preheader: preheaderOf(copy),
    html: [hello.html, words.html, card.html, cta.html, sign.html].join(""),
    text: textOf([hello.text, words.text, card.text, cta.text, sign.text]),
  };
}

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, defaultCopy));

export default template;
