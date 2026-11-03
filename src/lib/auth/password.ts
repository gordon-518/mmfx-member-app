import { en } from "@/i18n/messages/en";
import type { Messages } from "@/i18n/messages/types";
/** Single source of truth for the signup/reset password rule.
 *  Mirrors Supabase's server-side policy (min length 8) and adds a soft
 *  letter+digit requirement enforced client-side for better UX. */
export type PasswordCheck = { ok: boolean; message: string };

export function validatePassword(
  pw: string,
  /** The reader's copy; English by default. */
  e: Messages["auth"]["errors"] = en.auth.errors
): PasswordCheck {
  if (pw.length < 8) {
    return { ok: false, message: e.pwLength };
  }
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
    return { ok: false, message: e.pwMix };
  }
  return { ok: true, message: "" };
}
