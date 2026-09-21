import type { LifecycleTemplate } from "../types";
import { cta, esc, hi, p, SIGNOFF, textOf, url } from "../copy";

// Flow A, day 4, only if no TradingView username is saved. The indicators are
// already included in the trial but can't reach anyone's charts until the desk
// knows which TradingView account to grant. One action: save the username.

const template: LifecycleTemplate = (ctx) => {
  const link = url(ctx, "/indicators", "trial-tv");
  const body = [
    "Your trial includes the ten Market Makers indicators. They're sitting on our side of the wall, because access on TradingView is granted per username and we don't have yours yet.",
    "Put your TradingView username in on the indicators page and access is granted automatically. The ten show up in your TradingView account within one to three hours.",
    "It's one field and it takes about ten seconds. Everything else about the indicators waits on it.",
  ];

  return {
    subject: "Add your TradingView username",
    html: [p(esc(hi(ctx.firstName))), ...body.map((b) => p(esc(b))), cta(link, "Add your username"), p(esc(SIGNOFF))].join(""),
    text: textOf([hi(ctx.firstName), ...body, `Add your username: ${link}`, SIGNOFF]),
  };
};

export default template;
