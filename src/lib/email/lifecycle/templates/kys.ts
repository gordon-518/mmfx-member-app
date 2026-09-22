import { button, tracker } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url } from "../copy";

// Flow A, day 2, only if Know Your Style is still unanswered. The cheapest step
// in the whole app and the one that makes everything after it personal. One
// action: answer the questions.

export const defaultCopy: LifecycleCopy = {
  subject: "Eight archetypes. One is yours.",
  preheader: "Three minutes of questions, then the habit you are least likely to see in yourself.",
  paragraphs: [
    "Know Your Style asks a short set of questions and names your archetype. There are eight. It takes about three minutes.",
    "What comes back is the set of habits that travels with that archetype, including the one most traders cannot see in themselves.",
    "It is yours to keep. From then on your dashboard and the tier page read it, and point you at the work that suits how you actually trade.",
  ],
  ctaLabel: "Take Know Your Style",
};

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = url(ctx, "/bots/know-your-style", "trial-kys");
  const words = paragraphs(copy);
  const list = tracker(ctx.onboarding, "kys");
  const cta = button(link, copy.ctaLabel);
  const hello = greeting(ctx);
  const sign = signoff();

  return {
    subject: copy.subject,
    preheader: preheaderOf(copy),
    html: [hello.html, words.html, list.html, cta.html, sign.html].join(""),
    text: textOf([hello.text, words.text, list.text, cta.text, sign.text]),
  };
}

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, defaultCopy));

export default template;
