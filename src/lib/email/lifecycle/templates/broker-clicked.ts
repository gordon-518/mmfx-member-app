import { ADMIN_DISPLAY_NAME, ADMIN_TELEGRAM_URL } from "@/lib/depositRef";
import { button } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, paragraphs, preheaderOf, signoff, textOf } from "../copy";

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

export const defaultCopy: LifecycleCopy = {
  subject: "Stuck at the broker step?",
  preheader: "Account opening asks for documents. Amelia does this all day — just ask her.",
  paragraphs: [
    "You opened the broker account page the other day and didn't get to the end of it. That's common enough that we have a person for it.",
    "Account opening asks for identity documents and a proof of address, and it's easy to put down halfway and never pick up again. Sometimes an upload is rejected for something small. Sometimes the form asks for something you didn't have to hand.",
    `${ADMIN_DISPLAY_NAME} handles this all day. Message her on Telegram, say where you got to, and she'll walk you through the rest of it. She can't message you first, so the first message has to come from you. If you decided against it instead, that's a fine answer too — the free side of your account carries on as it is.`,
  ],
  ctaLabel: `Message ${ADMIN_DISPLAY_NAME}`,
};

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = `${ADMIN_TELEGRAM_URL}?cid=EML-hot-broker-clicked`;
  const words = paragraphs(copy);
  const cta = button(link, copy.ctaLabel);
  const hello = greeting(ctx);
  const sign = signoff();

  return {
    subject: copy.subject,
    preheader: preheaderOf(copy),
    html: [hello.html, words.html, cta.html, sign.html].join(""),
    text: textOf([hello.text, words.text, cta.text, sign.text]),
  };
}

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, defaultCopy));

export default template;
