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
  subject: "Half way through the broker form",
  preheader: "Amelia does these every day. Tell her where you stopped and she takes it from there.",
  paragraphs: [
    "You opened the broker account page yesterday and stopped somewhere in the middle. That happens often enough that we keep a person for it.",
    "The form asks for an identity document and a proof of address. Uploads get rejected for small reasons. Forms ask for things you did not have to hand.",
    "Message Admin Amelia on Telegram and say where you stopped. She cannot write to you first, so the first line has to be yours. If you have changed your mind, that is a fine answer. The free side of your account stays as it is.",
  ],
  ctaLabel: "Message Admin Amelia",
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
