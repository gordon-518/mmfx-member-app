import { en } from "@/i18n/messages/en";
import type { Messages } from "@/i18n/messages/types";

/** Translate Supabase auth error strings into friendly, enumeration-safe copy. */
export function friendlyAuthError(
  raw: string | undefined,
  /** The reader's copy; English by default. */
  e: Messages["auth"]["errors"] = en.auth.errors
): string {
  const m = (raw ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) {
    return e.invalidCredentials;
  }
  if (m.includes("email not confirmed")) {
    return e.notConfirmed;
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return e.alreadyRegistered;
  }
  if (
    m.includes("token has expired") ||
    (m.includes("invalid") && m.includes("token")) ||
    m.includes("otp")
  ) {
    return e.badCode;
  }
  if (m.includes("for security purposes") || m.includes("rate limit")) {
    return e.rateLimit;
  }
  return e.generic;
}
