import { button, tracker } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url } from "../copy";

// Flow A, day 6, only if no lesson has been finished. Nineteen lessons is a
// wall; the job of this email is to make it one lesson instead. One action:
// open the course at Foundations.

export const defaultCopy: LifecycleCopy = {
  subject: "Where to start in the course",
  preheader: "Nineteen lessons is a wall. There is only one you need to open today.",
  paragraphs: [
    "Nineteen lessons is the kind of number people put off until a quiet weekend that never comes. So ignore it. There's only one lesson you need to open.",
    "Module 1 is Foundations, and it's on every account here whether you deposit or not. It starts with Golden Mindset — the discipline the rest of the system stands on — then XAUUSD Explained, then What Moves Gold?: the dollar, real yields, risk sentiment and geopolitics, and why gold behaves the way it does when they move.",
    "Each lesson is a video with the slide deck alongside it. Start one. You can stop after it.",
  ],
  ctaLabel: "Open the course",
};

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = url(ctx, "/course", "trial-lesson1");
  const words = paragraphs(copy);
  const list = tracker(ctx.onboarding, "lesson1");
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
