import { button, ladder as ladderStrip } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url } from "../copy";

// Flow C, 48 hours after someone looked at the tier page and didn't deposit.
// They're not unconvinced by the product — they're unsure what the money is.
// This email exists to answer that one question calmly. One action: go back and
// read the tiers now that the number makes sense.

export const defaultCopy: LifecycleCopy = {
  subject: "The deposit stays in your name",
  preheader: "Not a payment to us. It is trading capital at a broker, yours to hold and withdraw.",
  paragraphs: [
    "You opened the tier page two days ago and left it there. The sticking point is usually the same one, so here it is plainly.",
    "The deposit is not paid to Market Makers. It goes into a trading account opened in your name, under your login. You hold it, you trade with it, you can withdraw it.",
    "On our side it only sets your rung. The total counts cumulatively and holds at its high-water mark, so a drawdown never takes back access you already have. The page reads differently with that in mind.",
  ],
  ctaLabel: "Read the tiers again",
};

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = url(ctx, "/upgrade", "hot-upgrade-seen");
  const words = paragraphs(copy);
  const rungs = ladderStrip();
  const cta = button(link, copy.ctaLabel);
  const hello = greeting(ctx);
  const sign = signoff();

  return {
    subject: copy.subject,
    preheader: preheaderOf(copy),
    html: [hello.html, words.html, rungs.html, cta.html, sign.html].join(""),
    text: textOf([hello.text, words.text, rungs.text, cta.text, sign.text]),
  };
}

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, defaultCopy));

export default template;
