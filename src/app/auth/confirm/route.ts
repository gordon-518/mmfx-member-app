import { type NextRequest, NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { clientIp, recordSignupIp } from "@/lib/signupIp";

// Magic-link / email-confirmation landing.
//
// PRIMARY: the token_hash flow (verifyOtp). This works on ANY device or
// browser — there's no PKCE "code verifier" tied to the originating browser,
// so "request on laptop, open email on phone" works, and the link isn't
// invalidated by requesting another. The email templates link here with
// ?token_hash=...&type=...
//
// FALLBACK: the legacy PKCE ?code= path, kept so links already sitting in
// inboxes (sent before this change) still work.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      await recordSignupIp(data.user?.id, clientIp(request));
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await recordSignupIp(data.user?.id, clientIp(request));
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
