import { button, featureCard } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url } from "../copy";

// Flow D, a week after a deposit is verified at Desk or above. Desk members
// find the indicators immediately and the Fundamental Desk almost never. One
// action: open it once.

export const defaultCopy: LifecycleCopy = {
  subject: "The Fundamental Desk, open today",
  preheader: "What is actually moving gold this week: the dollar, real yields, one calendar line",
  paragraphs: [
    "A week in, you have found the indicators. The Fundamental Desk is the half that gets opened less often, so here it is.",
    "It is a plain read on what is driving gold right now: the dollar, real yields, what the central banks are signalling, and the one line on this week's calendar that matters.",
    "Open it before your next session. Live classes with the desk sit beside it in the app, on your tier already.",
  ],
  ctaLabel: "Open the Fundamental Desk",
};

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = url(ctx, "/bots/fundamental", "member-d7");
  const words = paragraphs(copy);
  const card = featureCard(
    "fundamental-desk",
    "Fundamental Desk",
    "The macro picture behind the move, in plain English."
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
