import { type NextRequest, NextResponse } from "next/server";
import { type EmailOtpType, type User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { clientIp, recordSignupIp } from "@/lib/signupIp";
import { sendCapiEvent, fbcFromFbclid, splitName, type CapiUser } from "@/lib/meta-capi";

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
      await onAuthSuccess(request, data.user);
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await onAuthSuccess(request, data.user);
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}

// Runs once when a signup/confirmation succeeds: records the signup IP and
// fires the server-side conversion events. Guarded so analytics can never break
// the auth redirect.
async function onAuthSuccess(request: NextRequest, user: User | null) {
  const ip = clientIp(request);
  await recordSignupIp(user?.id, ip);
  try {
    await fireSignupConversions(request, user, ip);
  } catch (e) {
    console.error("[meta-capi] signup conversions failed:", e);
  }
}

async function fireSignupConversions(request: NextRequest, user: User | null, ip: string | null) {
  if (!user) return;

  // Attribution dropped by the marketing site on the shared parent-domain cookie.
  let attr: { cid?: string; geo?: string; feature?: string; fbclid?: string; ts?: number } = {};
  const rawAttr = request.cookies.get("mmfx_attr")?.value;
  if (rawAttr) {
    try {
      attr = JSON.parse(decodeURIComponent(rawAttr));
    } catch {
      /* ignore malformed cookie */
    }
  }

  const fbp = request.cookies.get("_fbp")?.value ?? null;
  const fbc = request.cookies.get("_fbc")?.value ?? fbcFromFbclid(attr.fbclid, attr.ts) ?? null;
  const { firstName, lastName } = splitName(
    (user.user_metadata?.full_name as string | undefined) ?? null,
  );

  const capiUser: CapiUser = {
    email: user.email ?? null,
    externalId: user.id,
    firstName,
    lastName,
    clientIp: ip,
    userAgent: request.headers.get("user-agent"),
    fbc,
    fbp,
  };

  const customData = {
    ...(attr.feature ? { content_name: attr.feature } : {}),
    ...(attr.cid ? { cid: attr.cid } : {}),
    ...(attr.geo ? { geo: attr.geo } : {}),
  };
  const sourceUrl = `${new URL(request.url).origin}/signup`;

  // Signup instantly starts the 14-day trial, so both fire at this one moment.
  await Promise.allSettled([
    sendCapiEvent({
      eventName: "CompleteRegistration",
      actionSource: "website",
      eventSourceUrl: sourceUrl,
      user: capiUser,
      customData,
    }),
    sendCapiEvent({
      eventName: "StartTrial",
      actionSource: "website",
      eventSourceUrl: sourceUrl,
      user: capiUser,
      customData,
    }),
  ]);
}
