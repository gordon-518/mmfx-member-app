import { button, featureCard } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url } from "../copy";

// Flow D, three days after a deposit is verified at Team MM, when the AI
// Trading Assistant has not been connected. The most expensive rung has the
// one feature nobody finds on their own. One action: connect the account.

export const defaultCopy: LifecycleCopy = {
  subject: "Connect your AI Trading Assistant",
  preheader: "It is on your tier and it does nothing until you connect an account.",
  paragraphs: [
    "You're on Team MM, which includes the AI Trading Assistant. It's the one thing on your tier that does nothing until you connect it, so it's usually the thing that never gets used.",
    "Connect your trading account and it reads your closed trades and shows you your own record back: how long you hold, what you tend to do in the hour after a loser, which setups you keep taking and which ones you talk about but never take.",
    "The connection is read-only. It can see the account's history; it can't place, size or close anything — and it gets more useful the more trades it has, which is an argument for connecting it now rather than later.",
  ],
  ctaLabel: "Connect the assistant",
};

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = url(ctx, "/journal", "member-d3");
  const words = paragraphs(copy);
  const card = featureCard(
    "ai-trading-assistant",
    "AI Trading Assistant",
    "Read-only. It shows you your own record back."
  );
  const cta = button(link, copy.ctaLabel);
  const hello = greeting(ctx);
  const sign = signoff();

  return {
    subject: copy.subject,
    preheader: preheaderOf(copy),
    html: [hello.html, words.html, card.html, cta.html, sign.html].join(""),
    text: textOf([hello.text, words.text, card.text, cta.text, sign.text]),
  };
}

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, defaultCopy));

export default template;
