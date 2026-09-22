import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { isDemoUser } from "@/lib/showcase";

// Post-click email attribution (email v2 §4). Every lifecycle link carries
// ?cid=EML-<flow>-<step>; this is the one place that sees it, because the
// reader lands on an ordinary page and the cid is gone by the next click.
// Without this row, a click is the last thing the rail ever observes — the
// Free tier has no signup or deposit to attribute afterwards.
//
// Middleware runs on the Edge runtime, so there is no supabase-js service
// client here: this is a plain fetch to PostgREST with the service-role key,
// fired and forgotten, and fn_log_event_as (service_role only) is the door.
// fn_app_event_insert dedupes the same cid for the same user within 24h, so a
// refresh or a second tab is not a second visit.
const EML_CID = /^EML-[a-z0-9-]+$/;

function logEmailVisit(userId: string, cid: string, path: string): Promise<void> | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;
  return fetch(`${base}/rest/v1/rpc/fn_log_event_as`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      p_user_id: userId,
      p_event: "email_visit",
      p_props: { cid, path },
    }),
    // Never awaited by the request, never retried: the reader's page must not
    // wait on, or break because of, an analytics write. The caller hands the
    // promise to the fetch event's waitUntil, because on the Edge runtime a
    // dangling fetch can be cancelled the moment the response is sent.
  }).then(() => undefined, () => undefined);
}

export async function proxy(request: NextRequest, event?: NextFetchEvent) {
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
  // Showcase (demo) sessions: keep them out of search indexes entirely.
  if (isDemoUser(user?.email)) {
    supabaseResponse.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  const ROADMAP_SINCE = Date.parse("2026-07-01T00:00:00Z");
  const path = request.nextUrl.pathname;

  const cid = request.nextUrl.searchParams.get("cid");
  if (user && cid && EML_CID.test(cid)) {
    const write = logEmailVisit(user.id, cid, path);
    if (write) event?.waitUntil?.(write);
  }
  const exempt = /^\/(welcome|showcase|login|signup|forgot-password|auth|api|privacy|terms)(\/|$)/.test(path);
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
