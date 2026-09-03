"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sendSignupConversions, fbcFromFbclid, splitName } from "@/lib/meta-capi";
import { recordSignupIp } from "@/lib/signupIp";

// Fires the signup conversions for the in-page email-OTP flow (SignupForm's
// client-side verifyOtp never hits /auth/confirm, so the events have to be sent
// from here). Called right after a successful verify. Reads the just-created
// session server-side plus the attribution / fb cookies. Guarded — analytics
// can never break signup.
export async function recordSignupConversion(): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const c = await cookies();
    const h = await headers();

    let attr: { cid?: string; geo?: string; feature?: string; fbclid?: string; ts?: number } = {};
    const rawAttr = c.get("mmfx_attr")?.value;
    if (rawAttr) {
      try {
        attr = JSON.parse(decodeURIComponent(rawAttr));
      } catch {
        /* ignore malformed cookie */
      }
    }

    const fbp = c.get("_fbp")?.value ?? null;
    const fbc = c.get("_fbc")?.value ?? fbcFromFbclid(attr.fbclid, attr.ts) ?? null;
    const { firstName, lastName } = splitName(
      (user.user_metadata?.full_name as string | undefined) ?? null,
    );
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    // The in-page email-OTP flow never hits /auth/confirm (that route only
    // records signup_ip for OAuth), so this is the only place email/password
    // signups get their IP captured for /admin/abuse.
    await recordSignupIp(user.id, ip);

    // Persist attribution BEFORE the CAPI call — CAPI is best-effort and can throw,
    // and losing the cid means the signup can never be attributed to its post/ad.
    if (attr.cid || attr.geo || attr.feature) {
      const { error: attrError } = await supabase
        .from("profiles")
        .update({
          attr_cid: attr.cid ?? null,
          attr_geo: attr.geo ?? null,
          attr_feature: attr.feature ?? null,
        })
        .eq("id", user.id)
        .is("attr_cid", null); // first touch wins — never overwrite on a re-trial
      if (attrError) console.error("[attribution] persist failed:", attrError);
    }

    await sendSignupConversions(
      {
        email: user.email ?? null,
        externalId: user.id,
        firstName,
        lastName,
        clientIp: ip,
        userAgent: h.get("user-agent"),
        fbc,
        fbp,
      },
      { feature: attr.feature, cid: attr.cid, geo: attr.geo },
      "https://app.marketmakersfx.net/signup",
    );
  } catch (e) {
    console.error("[meta-capi] recordSignupConversion failed:", e);
  }
}
