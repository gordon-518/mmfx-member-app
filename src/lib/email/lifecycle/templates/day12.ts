import type { LifecycleTemplate } from "../types";
import { cta, esc, hi, p, SIGNOFF, textOf, url } from "../copy";

// Flow A, day 12 of 14, to everyone still on trial. Written to be the least
// dramatic email in the sequence: what the account loses, what it keeps, and
// nothing about time running out. One action: see what each rung opens.

const template: LifecycleTemplate = (ctx) => {
  const link = url(ctx, "/upgrade", "trial-day12");
  const body = [
    "Your trial runs to day 14. Here's the plain version of what happens then, because the vague version is how people end up surprised.",
    "What closes: the ten TradingView indicators, the strategy scripts, live classes, the Fundamental Desk, and the lessons past Module 1.",
    "What stays, with no deposit at all: the Daily Analysis every trading day, Know Your Style, Module 1 of the course, the economic calendar, the news feed and the public signals channel. Your login keeps working. Nothing is deleted and nothing is charged.",
    "If you do want the rest back, the tier page lays out what each rung opens. If you don't, the Daily Analysis will be there tomorrow either way.",
  ];

  return {
    subject: "What changes on day 14",
    html: [p(esc(hi(ctx.firstName))), ...body.map((b) => p(esc(b))), cta(link, "See what each rung opens"), p(esc(SIGNOFF))].join(""),
    text: textOf([hi(ctx.firstName), ...body, `See what each rung opens: ${link}`, SIGNOFF]),
  };
};

export default template;
