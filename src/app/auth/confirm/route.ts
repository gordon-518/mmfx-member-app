import { type NextRequest, NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { clientIp, recordSignupIp } from "@/lib/signupIp";

// OAuth / email-confirmation landing.
//
// PRIMARY (current): the PKCE ?code= flow (exchangeCodeForSession). This is how
// "Continue with Google" returns — Google redirects back here with ?code=.
//
// FALLBACK: the token_hash flow (verifyOtp), kept so any in-flight links from
// the retired magic-link era (?token_hash=...&type=...) still resolve. The live
// signup/reset flows now verify their 6-digit codes in-page and never land here.
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
