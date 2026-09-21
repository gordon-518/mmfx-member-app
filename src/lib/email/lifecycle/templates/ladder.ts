import type { LifecycleTemplate } from "../types";
import { cta, esc, hi, p, SIGNOFF, textOf, url } from "../copy";

// Flow A, day 9, to everyone still on trial. The first and only time the trial
// sequence explains how access works here, stated as a map rather than an
// offer. The deposit line is the point of the whole email. One action: read the
// comparison for yourself.

const template: LifecycleTemplate = (ctx) => {
  const link = url(ctx, "/upgrade", "trial-ladder");
  const rungs = [
    "Free, at no cost, for as long as you have an account: the economic calendar, the news feed, Know Your Style, the Daily Analysis every trading day, Module 1 of the course, and the public signals channel.",
    "Foundation, at $50: the full course, all nineteen lessons, plus the MM Library.",
    "Desk, at $200: the ten TradingView indicators, the strategy scripts, live classes with the desk, and the Fundamental Desk's macro read.",
    "Team MM, at $500: the private Team MM channel, where the desk's own calls go out, and the AI Trading Assistant.",
  ];
  const before = "Nine days in, so here's the map of how access works here. No pitch attached — you can read it and do nothing.";
  const deposit =
    "About those numbers. They're not prices and they're not paid to Market Makers. Each one is a deposit into a trading account at a partner broker, opened in your name. You hold it, you trade with it, and you can withdraw it. Your cumulative deposit is what sets your rung, and it's a high-water mark, so a drawdown never takes your access away.";

  return {
    subject: "What $50, $200 and $500 open",
    html: [
      p(esc(hi(ctx.firstName))),
      p(esc(before)),
      ...rungs.map((r) => p(esc(r))),
      p(esc(deposit)),
      cta(link, "See the full comparison"),
      p(esc(SIGNOFF)),
    ].join(""),
    text: textOf([
      hi(ctx.firstName),
      before,
      ...rungs.map((r) => `- ${r}`),
      deposit,
      `See the full comparison: ${link}`,
      SIGNOFF,
    ]),
  };
};

export default template;
