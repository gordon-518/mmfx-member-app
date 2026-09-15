// "Members message @MM_3000 first" (Gordon, 15 Sep). It's not advisable for
// the desk to contact members first on Telegram, so once a deposit is
// submitted, the last step is messaging Admin Amelia (@MM_3000). Each member
// gets a short reference code, derived from their user id so no storage is
// needed, to put in that message. The admin sees the same code in the review
// queue and the Telegram alert and matches the DM to the deposit.
//
// Honest limit: @MM_3000 is a personal account, so the app can't verify the
// message was sent. It records the click, and emails a reminder after 24
// hours without one (/api/cron/deposit-dm-reminder).

export const ADMIN_TELEGRAM_HANDLE = "MM_3000";
export const ADMIN_TELEGRAM_URL = `https://t.me/${ADMIN_TELEGRAM_HANDLE}`;
/** How members see the @MM_3000 account (Gordon, 15 Sep). */
export const ADMIN_DISPLAY_NAME = "Admin Amelia";

/** "MM-3F9A2C": stable per member, the first 6 hex characters of the user id. */
export function depositRef(userId: string): string {
  return `MM-${userId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

/** The message the member sends to @MM_3000, after submitting. */
export function adminDmMessage(ref: string, amount?: number): string {
  const what = amount ? `my $${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} deposit` : "my deposit";
  return `Hi Amelia, I've just submitted ${what} on the MMFX app. My reference is ${ref}.`;
}
