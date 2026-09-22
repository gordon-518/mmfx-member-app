import { button, featureCard } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url } from "../copy";

// Flow D, a week after a deposit is verified at Desk or above. Desk members
// find the indicators immediately and the Fundamental Desk almost never. One
// action: open it once.

export const defaultCopy: LifecycleCopy = {
  subject: "This week at the Fundamental Desk",
  preheader: "A live macro read on gold, in plain English. Most members never open it.",
  paragraphs: [
    "A week in. You've almost certainly found the indicators. The Fundamental Desk you almost certainly haven't, so here it is.",
    "It's a live macro read on gold, in plain English: the current fundamental picture driving XAUUSD — the dollar, real yields, what the central banks are signalling, and which line on this week's calendar is the one that matters.",
    "If you've ever watched gold move hard and had no idea what caused it, that's the page to have open. Live classes with the desk are on your tier too — the schedule sits in the app alongside it.",
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
