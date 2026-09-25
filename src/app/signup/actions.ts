"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sendSignupConversions, fbcFromFbclid, splitName } from "@/lib/meta-capi";
import { recordSignupIp } from "@/lib/signupIp";
import { serviceClient } from "@/lib/journal/api";
import { recordTouch } from "@/lib/attribution/touch";

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
    //
    // Through a security-definer RPC (conversion-fix 1.1). profiles has no UPDATE
    // policy, so the direct .update() this replaced matched zero rows and returned
    // NO error — every signup from 3–10 Sep lost its attribution silently. The RPC
    // writes the caller's own row, first touch only, within 24h of signup.
    if (attr.cid || attr.geo || attr.feature) {
      const { error: attrError } = await supabase.rpc("fn_set_signup_attribution", {
        p_cid: attr.cid ?? null,
        p_geo: attr.geo ?? null,
        p_feature: attr.feature ?? null,
      });
      if (attrError) console.error("[attribution] persist failed:", attrError.message);
    }

    // The same cid, again, as a row in the touch log (partners §2.2). The
    // profile column above is FIRST touch and is written once; the log is the
    // running record, and the signup touch has to be in it or a partner's
    // funnel would start at the first visit AFTER the signup.
    //
    // Service-role, because attribution_touches has RLS on and no policies —
    // the session client would match nothing and, as in the 2026-09-10
    // attribution bug, report no error. recordTouch never throws.
    if (attr.cid) {
      await recordTouch(serviceClient(), {
        userId: user.id,
        cid: attr.cid,
        geo: attr.geo ?? null,
        path: "/signup",
      });
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
