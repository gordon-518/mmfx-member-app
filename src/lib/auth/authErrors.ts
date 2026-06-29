/** Translate Supabase auth error strings into friendly, enumeration-safe copy. */
export function friendlyAuthError(raw: string | undefined): string {
  const m = (raw ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "That email or password doesn't match. Try again, or reset your password.";
  }
  if (m.includes("email not confirmed")) {
    return "Please verify your email first — check your inbox for the code.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "You already have an account with this email — try signing in.";
  }
  if (
    m.includes("token has expired") ||
    (m.includes("invalid") && m.includes("token")) ||
    m.includes("otp")
  ) {
    return "That code is wrong or expired. Request a new one.";
  }
  if (m.includes("for security purposes") || m.includes("rate limit")) {
    return "Too many attempts — please wait a minute and try again.";
  }
  return "Something went wrong. Please try again.";
}
