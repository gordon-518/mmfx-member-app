import { button, featureCard } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url } from "../copy";

// Flow D, three days after a deposit is verified at Team MM, when the AI
// Trading Assistant has not been connected. The most expensive rung has the
// one feature nobody finds on their own. One action: connect the account.

export const defaultCopy: LifecycleCopy = {
  subject: "Connect the AI Trading Assistant",
  preheader: "Read-only access to your closed trades. One connection, about three minutes.",
  paragraphs: [
    "The assistant is already on your tier. Until an account is linked it has nothing to read, which is why it is usually the feature that never gets used.",
    "Link your trading account and it reads your closed trades, then shows you your own record back: how long you hold, what you do in the hour after a loser, which setups you keep taking.",
    "The link is read-only. It can see the account's history and it cannot place, size or close anything. It gets more useful the more trades it has, so today is worth more than next month.",
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
