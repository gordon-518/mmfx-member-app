import { button, tracker } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url } from "../copy";

// Flow A, day 6, only if no lesson has been finished. Nineteen lessons is a
// wall; the job of this email is to make it one lesson instead. One action:
// open the course at Foundations.

export const defaultCopy: LifecycleCopy = {
  subject: "Start with Golden Mindset",
  preheader: "Lesson one of Module 1. The other eighteen can wait for a weekend that never comes.",
  paragraphs: [
    "Nineteen lessons is the kind of number people put off. So ignore the number. Today there is one lesson.",
    "Golden Mindset opens Module 1. It is the discipline the rest of the system stands on, and everything after it assumes you have it. A video, with the slide deck beside it.",
    "Module 1 sits on every account here, deposit or not. Open the lesson. You can stop after it.",
  ],
  ctaLabel: "Watch Golden Mindset",
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
