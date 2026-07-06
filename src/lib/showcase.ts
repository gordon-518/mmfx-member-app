// Showcase mode = the demo member account. A no-login token link
// (/showcase?token=…) signs this account in; downstream code keys "showcase"
// behaviour (block paid file downloads, noindex) off `isDemoUser`.

export const DEMO_EMAIL = (process.env.SHOWCASE_DEMO_EMAIL ?? "demo@mmfx.test").toLowerCase();

/** True iff the given email is the showcase demo account (case-insensitive). */
export function isDemoUser(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === DEMO_EMAIL;
}
