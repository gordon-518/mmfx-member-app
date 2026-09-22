import { button, tracker } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url } from "../copy";

// Flow A, day 4, only if no TradingView username is saved. The indicators are
// already included in the trial but can't reach anyone's charts until the desk
// knows which TradingView account to grant. One action: save the username.

export const defaultCopy: LifecycleCopy = {
  subject: "Add your TradingView username",
  preheader: "One field, about ten seconds, and the ten indicators reach your charts.",
  paragraphs: [
    "Your trial includes the ten Market Makers indicators. They're sitting on our side of the wall, because access on TradingView is granted per username and we don't have yours yet.",
    "Put your TradingView username in on the indicators page and access is granted automatically. The ten show up in your TradingView account within one to three hours.",
    "It's one field and it takes about ten seconds. Everything else about the indicators waits on it.",
  ],
  ctaLabel: "Add your username",
};

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = url(ctx, "/indicators", "trial-tv");
  const words = paragraphs(copy);
  const list = tracker(ctx.onboarding, "tv");
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
