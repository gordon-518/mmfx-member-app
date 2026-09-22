import { button, tracker } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url } from "../copy";

// Flow A, day 4, only if no TradingView username is saved. The indicators are
// already included in the trial but can't reach anyone's charts until the desk
// knows which TradingView account to grant. One action: save the username.

export const defaultCopy: LifecycleCopy = {
  subject: "Your TradingView username",
  preheader: "TradingView grants access per username, and yours is the one field we don't have.",
  paragraphs: [
    "The ten Market Makers indicators are ready on our side. TradingView grants access per username, so yours is the one thing missing.",
    "Add it on the indicators page. Access is granted automatically, and the ten appear on your charts within one to three hours.",
    "One field, about ten seconds. Nothing else about the indicators moves until it is there.",
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
