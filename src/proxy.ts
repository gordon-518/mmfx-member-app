import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { isDemoUser } from "@/lib/showcase";
import { ATTR_CID, CID_MAX } from "@/lib/attribution/touch";

// Post-click attribution. Every link we tag carries ?cid=…; this is the one
// place that sees it, because the reader lands on an ordinary page and the cid
// is gone by the next click. Without these rows, a click is the last thing we
// ever observe — the Free tier has no signup or deposit to attribute
// afterwards.
//
// Started as email-only (email v2 §4). Widened to every channel for the
// partner rail (design 2026-09-25 §2.2): a landing now writes up to three
// things, and which ones depends on the prefix.
//
//   email_visit   EML- only. Untouched, so every lifecycle KPI reads exactly
//                 what it read yesterday.
//   cid_visit     any recognised cid. The wider signal, deduped per cid per
//                 day by fn_app_event_insert.
//   a touch row   any recognised cid, through fn_record_touch. This is the
//                 one that makes "which ad did they last see before they
//                 funded" answerable, and the only one the partner funnel
//                 reads under last_paid_7d.
//
// Middleware runs on the Edge runtime, so there is no supabase-js service
// client here: these are plain fetches to PostgREST with the service-role
// key, fired and forgotten. Both RPCs are granted to service_role alone.
function rpc(fn: string, body: Record<string, unknown>): Promise<void> | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;
  return fetch(`${base}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    // Never awaited by the request, never retried: the reader's page must not
    // wait on, or break because of, an analytics write. The caller hands the
    // promise to the fetch event's waitUntil, because on the Edge runtime a
    // dangling fetch can be cancelled the moment the response is sent.
  }).then(() => undefined, () => undefined);
}

const EML_CID = /^EML-[a-z0-9-]+$/;

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

  // The cid is trimmed and capped before anything reads it: it arrives from a
  // URL a stranger can write, and the column caps at the same place.
  const cid = (request.nextUrl.searchParams.get("cid") ?? "").trim().slice(0, CID_MAX);
  if (user && cid && ATTR_CID.test(cid)) {
    const geo = request.nextUrl.searchParams.get("geo");
    const writes = [
      // EML- keeps its own event so the lifecycle KPIs are unchanged.
      EML_CID.test(cid)
        ? rpc("fn_log_event_as", {
            p_user_id: user.id,
            p_event: "email_visit",
            p_props: { cid, path },
          })
        : null,
      rpc("fn_log_event_as", {
        p_user_id: user.id,
        p_event: "cid_visit",
        p_props: { cid, path },
      }),
      rpc("fn_record_touch", {
        p_user_id: user.id,
        p_cid: cid,
        p_geo: geo,
        p_path: path,
        p_anon_id: null,
      }),
    ];
    for (const write of writes) if (write) event?.waitUntil?.(write);
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
