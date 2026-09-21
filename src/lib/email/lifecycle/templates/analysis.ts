import type { LifecycleTemplate } from "../types";
import { cta, esc, hi, p, SIGNOFF, textOf, url } from "../copy";

// Flow A, day 1 of the 14-day trial, only if they have never opened the Daily
// Analysis. It names today's read by title and bias so the email is the thing
// itself, not an advert for it, and asks for one action: open today's analysis.

const template: LifecycleTemplate = (ctx) => {
  const link = url(ctx, "/daily-analysis", "trial-analysis");
  const today = ctx.todayAnalysis;
  const todayHtml = today
    ? `Today's is up: <b>${esc(today.title)}</b>, bias ${esc(today.bias)}.`
    : "The next one goes up before the session.";
  const todayText = today
    ? `Today's is up: ${today.title}, bias ${today.bias}.`
    : "The next one goes up before the session.";

  return {
    subject: "Today's read on gold",
    html: [
      p(esc(hi(ctx.firstName))),
      p(
        "You signed up the other day, so here's the one thing the desk does every trading morning: it writes down its read on gold before the session opens."
      ),
      p(todayHtml),
      p(
        "A short video and a PDF. Where price sat overnight, the levels the desk is watching, and the bias it's working from. You don't have to agree with it — it's a second opinion you can hold your own chart against."
      ),
      cta(link, "Open today's analysis"),
      p(esc(SIGNOFF)),
    ].join(""),
    text: textOf([
      hi(ctx.firstName),
      "You signed up the other day, so here's the one thing the desk does every trading morning: it writes down its read on gold before the session opens.",
      todayText,
      "A short video and a PDF. Where price sat overnight, the levels the desk is watching, and the bias it's working from. You don't have to agree with it — it's a second opinion you can hold your own chart against.",
      `Open today's analysis: ${link}`,
      SIGNOFF,
    ]),
  };
};

export default template;
