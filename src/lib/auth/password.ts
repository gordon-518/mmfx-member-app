/** Single source of truth for the signup/reset password rule.
 *  Mirrors Supabase's server-side policy (min length 8) and adds a soft
 *  letter+digit requirement enforced client-side for better UX. */
export type PasswordCheck = { ok: boolean; message: string };

export function validatePassword(pw: string): PasswordCheck {
  if (pw.length < 8) {
    return { ok: false, message: "Use at least 8 characters." };
  }
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
    return { ok: false, message: "Include at least one letter and one number." };
  }
  return { ok: true, message: "" };
}
