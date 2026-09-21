import type { LifecycleTemplate } from "../types";
import { cta, esc, hi, p, SIGNOFF, textOf, url } from "../copy";

// Flow C, 48 hours after someone looked at the tier page and didn't deposit.
// They're not unconvinced by the product — they're unsure what the money is.
// This email exists to answer that one question calmly. One action: go back and
// read the tiers now that the number makes sense.

const template: LifecycleTemplate = (ctx) => {
  const link = url(ctx, "/upgrade", "hot-upgrade-seen");
  const body = [
    "You had a look at the tier page a couple of days ago and left it there. Nine times out of ten it's the same sticking point, so let me answer it plainly.",
    "The deposit isn't a fee. It's not paid to Market Makers and it doesn't buy a subscription. It's a deposit into a trading account at a partner broker, opened in your name, under your login. You hold it, you trade with it, and you can withdraw it. It's your own trading capital, sitting where you would need it to sit anyway.",
    "What it does on our side is set your rung. $50 opens the full course and the MM Library. $200 adds the ten indicators, the strategy scripts, live classes and the Fundamental Desk. $500 adds the private Team MM channel and the AI Trading Assistant. The total counts cumulatively, and it's a high-water mark, so a drawdown never removes access you already have.",
    "If that's not what you thought it was, the tier page reads differently the second time.",
  ];

  return {
    subject: "The deposit stays in your name",
    html: [p(esc(hi(ctx.firstName))), ...body.map((b) => p(esc(b))), cta(link, "Read the tiers again"), p(esc(SIGNOFF))].join(""),
    text: textOf([hi(ctx.firstName), ...body, `Read the tiers again: ${link}`, SIGNOFF]),
  };
};

export default template;
