// "Message @MM_3000 first" (Gordon, 15 Sep). It's not advisable for the desk
// to contact members first on Telegram, so the deposit form makes messaging
// the admin account step 1. Each member gets a short reference code, derived
// from their user id so no storage is needed, to put in that message. The
// admin sees the same code in the review queue and the Telegram alert and
// matches the DM to the deposit.
//
// Honest limit: @MM_3000 is a personal account, so the app can't verify the
// message was sent. It can only make opening the chat a required step.

export const ADMIN_TELEGRAM_HANDLE = "MM_3000";
export const ADMIN_TELEGRAM_URL = `https://t.me/${ADMIN_TELEGRAM_HANDLE}`;

/** "MM-3F9A2C": stable per member, the first 6 hex characters of the user id. */
export function depositRef(userId: string): string {
  return `MM-${userId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

/** The message the member sends to @MM_3000. */
export function adminDmMessage(ref: string): string {
  return `Hi, I'm submitting my deposit on the MMFX app. My reference is ${ref}.`;
}
