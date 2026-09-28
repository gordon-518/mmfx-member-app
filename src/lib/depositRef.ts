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

export interface AdminDmDetails {
  ref: string;
  amount?: number | null;
  broker?: string | null;
  /** The member's trading account number at the broker. */
  account?: string | null;
}

/**
 * The message the member sends to @MM_3000, after submitting. It carries the
 * deposit's details so the admin can check the broker's back office from the
 * DM alone, without asking the member for them (28 Sep). The reference stays
 * last: the card highlights it in place.
 */
export function adminDmMessage(d: AdminDmDetails): string {
  const what = d.amount
    ? `my $${d.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} deposit`
    : "my deposit";
  const details = [
    d.broker ? `broker ${d.broker}` : null,
    d.account ? `trading account ${d.account}` : null,
  ].filter((x): x is string => x !== null);
  const middle = details.length > 0 ? ` My ${details.join(", ")}.` : "";
  return `Hi Amelia, I've just submitted ${what} on the MMFX app.${middle} My reference is ${d.ref}.`;
}
