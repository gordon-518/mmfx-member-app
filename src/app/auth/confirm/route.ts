import { type NextRequest, NextResponse } from "next/server";
import { type EmailOtpType, type User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { clientIp, recordSignupIp, recordSignupCountry } from "@/lib/signupIp";
import { sendSignupConversions, fbcFromFbclid, splitName, type CapiUser } from "@/lib/meta-capi";

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
      await onAuthSuccess(request, data.user, supabase);
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await onAuthSuccess(request, data.user, supabase);
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}

// Runs once when a signup/confirmation succeeds: records the signup IP and
// fires the server-side conversion events. Guarded so analytics can never break
// the auth redirect.
async function onAuthSuccess(
  request: NextRequest,
  user: User | null,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const ip = clientIp(request);
  await recordSignupIp(user?.id, ip);
  // OAuth (Google) signups carry no country in metadata — fill set-once from the
  // edge geo header. No-op for email signups (country already set via the form).
  await recordSignupCountry(user?.id, request.headers.get("x-vercel-ip-country"));

  // Persist signup attribution on the Google path too (conversion-fix 1.1).
  // Before, this route only forwarded the cookie to CAPI and discarded it. The
  // RPC is first-touch and signup-time only, so a returning user's login with a
  // fresh ad cookie is a no-op rather than a re-attribution of an old signup.
  const attr = readAttr(request);
  if (user && (attr.cid || attr.geo || attr.feature)) {
    try {
      const { error } = await supabase.rpc("fn_set_signup_attribution", {
        p_cid: attr.cid ?? null,
        p_geo: attr.geo ?? null,
        p_feature: attr.feature ?? null,
      });
      if (error) console.error("[attribution] persist failed:", error.message);
    } catch (e) {
      console.error("[attribution] persist threw:", e);
    }
  }
  try {
    await fireSignupConversions(request, user, ip);
  } catch (e) {
    console.error("[meta-capi] signup conversions failed:", e);
  }
}

async function fireSignupConversions(request: NextRequest, user: User | null, ip: string | null) {
  if (!user) return;

  // Attribution dropped by the marketing site on the shared parent-domain cookie.
  const attr = readAttr(request);

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

  await sendSignupConversions(
    capiUser,
    { feature: attr.feature, cid: attr.cid, geo: attr.geo },
    `${new URL(request.url).origin}/signup`,
  );
}

type Attr = { cid?: string; geo?: string; feature?: string; fbclid?: string; ts?: number };

/** The mmfx_attr cookie the marketing site sets on .marketmakersfx.net. */
function readAttr(request: NextRequest): Attr {
  const raw = request.cookies.get("mmfx_attr")?.value;
  if (!raw) return {};
  try {
    const v = JSON.parse(decodeURIComponent(raw));
    return v && typeof v === "object" ? (v as Attr) : {};
  } catch {
    return {}; // malformed cookie
  }
}
