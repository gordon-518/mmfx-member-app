import type { LifecycleTemplate } from "../types";
import { cta, esc, hi, p, SIGNOFF, textOf, url } from "../copy";

// Flow D, three days after a deposit is verified at Team MM, when the AI
// Trading Assistant has not been connected. The most expensive rung has the
// one feature nobody finds on their own. One action: connect the account.

const template: LifecycleTemplate = (ctx) => {
  const link = url(ctx, "/journal", "member-d3");
  const body = [
    "You're on Team MM, which includes the AI Trading Assistant. It's the one thing on your tier that does nothing until you connect it, so it's usually the thing that never gets used.",
    "Connect your trading account and it reads your closed trades and shows you your own record back: how long you hold, what you tend to do in the hour after a loser, which setups you keep taking and which ones you talk about but never take.",
    "The connection is read-only. It can see the account's history; it can't place, size or close anything.",
    "It gets more useful the more trades it has, which is an argument for connecting it now rather than later.",
  ];

  return {
    subject: "Connect your AI Trading Assistant",
    html: [p(esc(hi(ctx.firstName))), ...body.map((b) => p(esc(b))), cta(link, "Connect the assistant"), p(esc(SIGNOFF))].join(""),
    text: textOf([hi(ctx.firstName), ...body, `Connect the assistant: ${link}`, SIGNOFF]),
  };
};

export default template;
