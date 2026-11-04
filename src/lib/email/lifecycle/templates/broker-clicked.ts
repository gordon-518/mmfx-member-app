import { ADMIN_DISPLAY_NAME, ADMIN_TELEGRAM_URL } from "@/lib/depositRef";
import { button } from "@/lib/email/ui";
import { en } from "@/lib/email/i18n/en";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf, wordsOf } from "../copy";

// Flow C, 24 hours after someone clicked through to the broker and didn't come
// back with a deposit. Almost always a stuck account-opening — documents, a
// rejected upload, a form in the wrong language — not a change of heart. One
// action: tell Admin Amelia where you got stuck. (No prefilled reference here:
// depositRef's adminDmMessage describes a deposit already submitted, which by
// definition has not happened yet on this step.)
//
// The one step in the set with no module. Someone stuck halfway through an
// identity check does not need a tier strip or a progress list; they need one
// person's name and one link.

export const defaultCopy: LifecycleCopy = en.lifecycle.brokerClicked.copy;

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = `${ADMIN_TELEGRAM_URL}?cid=EML-hot-broker-clicked`;
  const words = paragraphs(copy);
  const cta = button(link, copy.ctaLabel);
  const hello = greeting(ctx);
  const sign = signoff(ctx);

  return {
    subject: copy.subject,
    preheader: preheaderOf(copy),
    html: [hello.html, words.html, cta.html, sign.html].join(""),
    text: textOf([hello.text, words.text, cta.text, sign.text]),
  };
}

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, wordsOf(ctx).lifecycle.brokerClicked.copy));

export default template;
