import { button, featureCard } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url } from "../copy";

// Flow D, once, when a member has not opened anything for thirty days — then
// sixty days of silence regardless of what they do with it. Deliberately the
// quietest email in the set: one door, held open, no argument. One action: read
// today's analysis.

export const defaultCopy: LifecycleCopy = {
  subject: "Today's read on gold",
  preheader: "A quiet month is fine. One read, three minutes, no catching up required.",
  paragraphs: [
    "Your account has been quiet for about a month. No pitch in this one. Markets are easier to walk away from than to come back to.",
    "The desk kept writing every trading morning: where gold sat overnight, the levels it is watching, the bias it is working from. A short video and a PDF, before the session.",
    "Start with today's, not a month of them. It is already on your account. And if Market Makers is not for you any more, unsubscribe below and we will leave you alone.",
  ],
  ctaLabel: "Open today's analysis",
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
