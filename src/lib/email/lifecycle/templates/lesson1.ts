import type { LifecycleTemplate } from "../types";
import { cta, esc, hi, p, SIGNOFF, textOf, url } from "../copy";

// Flow A, day 6, only if no lesson has been finished. Nineteen lessons is a
// wall; the job of this email is to make it one lesson instead. One action:
// open the course at Foundations.

const template: LifecycleTemplate = (ctx) => {
  const link = url(ctx, "/course", "trial-lesson1");
  const body = [
    "Nineteen lessons is the kind of number people put off until a quiet weekend that never comes. So ignore it. There's only one lesson you need to open.",
    "Module 1 is Foundations, and it's on every account here whether you deposit or not. It starts with Golden Mindset — the discipline the rest of the system stands on — then XAUUSD Explained, then What Moves Gold?: the dollar, real yields, risk sentiment and geopolitics, and why gold behaves the way it does when they move.",
    "Each lesson is a video with the slide deck alongside it. Start one. You can stop after it.",
  ];

  return {
    subject: "Where to start in the course",
    html: [p(esc(hi(ctx.firstName))), ...body.map((b) => p(esc(b))), cta(link, "Open the course"), p(esc(SIGNOFF))].join(""),
    text: textOf([hi(ctx.firstName), ...body, `Open the course: ${link}`, SIGNOFF]),
  };
};

export default template;
