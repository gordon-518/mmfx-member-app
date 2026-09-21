import type { LifecycleTemplate } from "../types";
import { cta, esc, hi, p, SIGNOFF, textOf, url } from "../copy";

// Flow A, day 2, only if Know Your Style is still unanswered. The cheapest step
// in the whole app and the one that makes everything after it personal. One
// action: answer the questions.

const template: LifecycleTemplate = (ctx) => {
  const link = url(ctx, "/bots/know-your-style", "trial-kys");
  const body = [
    "Before any of the charting, there's a question worth answering: what do you actually do when a trade goes against you?",
    "Know Your Style asks a few questions and gives you an archetype — the habits that tend to travel with it, and the one you're most likely to be blind to in yourself.",
    "It takes a few minutes, it's yours to keep, and the rest of the app reads it: your dashboard and the tier page both use your archetype to point you at what's worth your time.",
  ];

  return {
    subject: "Which kind of trader are you?",
    html: [p(esc(hi(ctx.firstName))), ...body.map((b) => p(esc(b))), cta(link, "Take Know Your Style"), p(esc(SIGNOFF))].join(""),
    text: textOf([hi(ctx.firstName), ...body, `Take Know Your Style: ${link}`, SIGNOFF]),
  };
};

export default template;
