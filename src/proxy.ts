import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session (also gives us the user for the first-run gate below).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // First-run roadmap gate: brand-new users (signed up on/after the ship date,
  // who haven't dismissed the roadmap) are sent to /welcome once. Uses only the
  // already-fetched user — no extra DB query. Existing users (created before the
  // cutoff) are never redirected, so there's no mass interruption.
  const ROADMAP_SINCE = Date.parse("2026-07-01T00:00:00Z");
  const path = request.nextUrl.pathname;
  const exempt = /^\/(welcome|login|signup|forgot-password|auth|api|privacy|terms)(\/|$)/.test(path);
  if (
    user &&
    !exempt &&
    !user.user_metadata?.roadmap_seen &&
    user.created_at &&
    Date.parse(user.created_at) > ROADMAP_SINCE
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    const redirectRes = NextResponse.redirect(url);
    // Carry over any refreshed auth cookies so the session isn't dropped.
    supabaseResponse.cookies.getAll().forEach((c) => redirectRes.cookies.set(c));
    return redirectRes;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
