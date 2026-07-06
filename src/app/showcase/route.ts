import { type NextRequest, NextResponse } from "next/server";
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
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const expected = process.env.SHOWCASE_TOKEN;
  const password = process.env.SHOWCASE_DEMO_PASSWORD;

  if (!expected || !password || !token || token !== expected) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password,
  });
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=showcase`);
  }
  return NextResponse.redirect(`${origin}/dashboard`);
}
