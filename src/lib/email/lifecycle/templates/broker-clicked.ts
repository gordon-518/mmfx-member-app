import { ADMIN_DISPLAY_NAME, ADMIN_TELEGRAM_URL } from "@/lib/depositRef";
import type { LifecycleTemplate } from "../types";
import { cta, esc, hi, p, SIGNOFF, textOf } from "../copy";

// Flow C, 24 hours after someone clicked through to the broker and didn't come
// back with a deposit. Almost always a stuck account-opening — documents, a
// rejected upload, a form in the wrong language — not a change of heart. One
// action: tell Admin Amelia where you got stuck. (No prefilled reference here:
// depositRef's adminDmMessage describes a deposit already submitted, which by
// definition has not happened yet on this step.)

const template: LifecycleTemplate = (ctx) => {
  const link = `${ADMIN_TELEGRAM_URL}?cid=EML-hot-broker-clicked`;
  const body = [
    "You opened the broker account page the other day and didn't get to the end of it. That's common enough that we have a person for it.",
    "Account opening asks for identity documents and a proof of address, and it's easy to put down halfway and never pick up again. Sometimes an upload is rejected for something small. Sometimes the form asks for something you didn't have to hand.",
    `${ADMIN_DISPLAY_NAME} handles this all day. Message her on Telegram, say where you got to, and she'll walk you through the rest of it. She can't message you first, so the first message has to come from you.`,
    "If you decided against it instead, that's a fine answer too — the free side of your account carries on as it is.",
  ];

  return {
    subject: "Stuck at the broker step?",
    html: [
      p(esc(hi(ctx.firstName))),
      ...body.map((b) => p(esc(b))),
      cta(link, `Message ${ADMIN_DISPLAY_NAME} on Telegram`),
      p(esc(SIGNOFF)),
    ].join(""),
    text: textOf([hi(ctx.firstName), ...body, `Message ${ADMIN_DISPLAY_NAME} on Telegram: ${link}`, SIGNOFF]),
  };
};

export default template;
