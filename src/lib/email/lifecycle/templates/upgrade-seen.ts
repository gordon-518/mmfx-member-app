import { button, ladder as ladderStrip } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, url } from "../copy";

// Flow C, 48 hours after someone looked at the tier page and didn't deposit.
// They're not unconvinced by the product — they're unsure what the money is.
// This email exists to answer that one question calmly. One action: go back and
// read the tiers now that the number makes sense.

export const defaultCopy: LifecycleCopy = {
  subject: "The deposit stays in your name",
  preheader: "It is not a fee and not a subscription. Here is what it actually is.",
  paragraphs: [
    "You had a look at the tier page a couple of days ago and left it there. Nine times out of ten it's the same sticking point, so let me answer it plainly.",
    "The deposit isn't a fee. It's not paid to Market Makers and it doesn't buy a subscription. It's a deposit into a trading account at a partner broker, opened in your name, under your login. You hold it, you trade with it, and you can withdraw it. It's your own trading capital, sitting where you would need it to sit anyway.",
    "What it does on our side is set your rung. The total counts cumulatively, and it's a high-water mark, so a drawdown never removes access you already have. If that's not what you thought it was, the tier page reads differently the second time.",
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
