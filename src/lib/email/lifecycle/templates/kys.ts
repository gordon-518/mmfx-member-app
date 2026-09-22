import { button, tracker } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url } from "../copy";

// Flow A, day 2, only if Know Your Style is still unanswered. The cheapest step
// in the whole app and the one that makes everything after it personal. One
// action: answer the questions.

export const defaultCopy: LifecycleCopy = {
  subject: "Which kind of trader are you?",
  preheader: "A few questions, an archetype, and the blind spot that travels with it.",
  paragraphs: [
    "Before any of the charting, there's a question worth answering: what do you actually do when a trade goes against you?",
    "Know Your Style asks a few questions and gives you an archetype — the habits that tend to travel with it, and the one you're most likely to be blind to in yourself.",
    "It takes a few minutes, it's yours to keep, and the rest of the app reads it: your dashboard and the tier page both use your archetype to point you at what's worth your time.",
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
