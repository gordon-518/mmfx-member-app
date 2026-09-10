import { type NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { DEMO_EMAIL } from "@/lib/showcase";

// No-login showcase entry. A correct ?token= signs in the demo member (see
// scripts/demo-user.mjs) server-side and drops the visitor on the dashboard, so
// external tools / people can view every page for product shots without logging
// in. Wrong or missing token → /login (opaque; no hint the route exists).
//
// Revoke by rotating SHOWCASE_TOKEN. The demo account is member_active but not
// admin, sees only its own fake profile + shared content, and is blocked from
// paid file downloads (see api/ebooks|slides|reports) + noindexed (see proxy.ts).
//
// Session minting: Supabase Auth has captcha protection on, so password sign-in
// fails server-side. Instead the service role generates a magic-link token hash
// (no email is sent) and the cookie-bound SSR client verifies it, which sets the
// session cookies on this response. Deliberately NOT routed via /auth/confirm —
// that fires the Meta CAPI signup events.
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const expected = process.env.SHOWCASE_TOKEN;

  if (!expected || !token || token !== expected) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const fail = NextResponse.redirect(`${origin}/login?error=showcase`);

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // generateLink creates the user if it doesn't exist. The demo account must
  // only ever come from scripts/demo-user.mjs (seeded profile), so refuse
  // rather than mint a fresh, unseeded account.
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", DEMO_EMAIL)
    .maybeSingle();
  if (!profile) return fail;

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: DEMO_EMAIL,
  });
  if (linkError || !link.properties?.hashed_token) return fail;

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (error) return fail;

  return NextResponse.redirect(`${origin}/dashboard`);
}
