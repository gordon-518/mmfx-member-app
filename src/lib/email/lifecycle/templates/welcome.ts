import type { LifecycleTemplate } from "../types";
import { cta, esc, hi, p, SIGNOFF, textOf, url } from "../copy";

// Flow A, day 0, everyone on a live trial. Three jobs in order: say what
// Market Makers is, answer the question nobody asks out loud ("what's the
// catch, if it's free?"), and earn ONE action — reading today's gold bias.
// Nothing about the ladder here; day 9 does that.

const BIAS: Record<string, string> = {
  bullish: "Bullish",
  bearish: "Bearish",
  neutral: "Neutral",
};

const template: LifecycleTemplate = (ctx) => {
  const link = url(ctx, "/daily-analysis", "trial-welcome");
  const da = ctx.todayAnalysis;

  const opening = [
    "Market Makers is a trading desk, not a course library. Every trading day we publish one read on gold — XAU/USD — worked top-down from the daily chart, and everything around it exists so you can build your own view rather than borrow ours.",
    "How it stays free: we're an introducing broker. When you trade through a broker we're partnered with, the broker pays us. You never pay Market Makers for access, and any deposit you make is yours — in your name, at the broker, and yours to withdraw.",
  ];

  const today = da
    ? `Today's read is ${da.title}${da.bias ? ` — ${BIAS[da.bias] ?? da.bias} bias` : ""}.${da.description ? ` ${da.description}` : ""}`
    : "Today's read goes up during the Asian session. It's the first thing to check each morning.";

  const todayHtml = da
    ? `Today's read is <b>${esc(da.title)}</b>${da.bias ? ` — ${esc(BIAS[da.bias] ?? da.bias)} bias` : ""}.${da.description ? ` ${esc(da.description)}` : ""}`
    : esc(today);

  const closing =
    "Your 14-day trial is open now: the daily read, Know Your Style, the economic calendar, live news and the MM System course. After day 14 the account stays — Daily Analysis, Know Your Style, the calendar, news and Module 1 of the course are yours either way.";

  return {
    subject: "Welcome in — start with today's gold read",
    html: [
      p(esc(hi(ctx.firstName))),
      ...opening.map((o) => p(esc(o))),
      p(todayHtml),
      cta(link, "Open today's analysis"),
      p(esc(closing)),
      p(esc(SIGNOFF)),
    ].join(""),
    text: textOf([
      hi(ctx.firstName),
      ...opening,
      today,
      `Open today's analysis: ${link}`,
      closing,
      SIGNOFF,
    ]),
  };
};

export default template;
