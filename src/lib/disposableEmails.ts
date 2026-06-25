// Common disposable / temporary email domains. Used to block the laziest
// trial abuse (throwaway inboxes) at signup. Not exhaustive — it covers the
// popular temp-mail providers; the device/IP/TV-username signals catch the rest.
// Pure module (no browser/server deps) so it runs on both sides.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "10minutemail.com", "guerrillamail.com", "guerrillamail.info",
  "guerrillamail.net", "guerrillamail.org", "sharklasers.com", "grr.la",
  "temp-mail.org", "tempmail.com", "tempmail.net", "tempmailo.com", "temp-mail.io",
  "tempr.email", "tmpmail.org", "tmpmail.net", "throwawaymail.com", "throwaymail.com",
  "yopmail.com", "yopmail.net", "yopmail.fr", "cool.fr.nf", "jetable.fr.nf",
  "trashmail.com", "trashmail.net", "trashmail.de", "mailnesia.com", "maildrop.cc",
  "getnada.com", "nada.email", "dispostable.com", "fakeinbox.com", "fakemailgenerator.com",
  "emailondeck.com", "mohmal.com", "moakt.com", "mailcatch.com", "spamgourmet.com",
  "spam4.me", "33mail.com", "tempinbox.com", "mailtemp.info", "mintemail.com",
  "mytemp.email", "mailsac.com", "burnermail.io", "anonbox.net", "maileater.com",
  "1secmail.com", "1secmail.org", "1secmail.net", "wwjmp.com", "esiix.com",
  "vjuum.com", "laafd.com", "txcct.com", "dropmail.me", "10mail.org",
  "minuteinbox.com", "instant-mail.de", "discard.email", "discardmail.com",
  "spambog.com", "spambox.us", "tempemail.co", "tempmailaddress.com", "luxusmail.org",
]);

/** True if the email's domain is a known disposable/temp-mail provider. */
export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}
