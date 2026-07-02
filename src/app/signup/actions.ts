"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sendSignupConversions, fbcFromFbclid, splitName } from "@/lib/meta-capi";

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
