import { NextResponse } from "next/server";
import { adminDb } from "@/lib/channel/db";
import { resolveDestination, isAppDestination } from "@/lib/channel/destinations";

export const runtime = "nodejs";

const ATTR_COOKIE = "mmfx_attr";
const ATTR_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, same as the ad + SEO cookies

// The Telegram channel's cid family. ORG-* is organic social in the house
// taxonomy (CRT- paid, EML- email, AGY- partners, SEO- guides — see the
// marketing site's seoAttribution.ts). The post id sits after a dot because
// uuids contain hyphens, so `ORG-tg-<slug>.<post id>` stays parseable.
function telegramCid(slug: string, postId: string | null): string {
  return postId ? `ORG-tg-${slug}.${postId}` : `ORG-tg-${slug}`;
}

// Same precedence rule as every other attribution surface: a cid already in
// the cookie wins — first touch keeps the credit, and a channel click must
// never steal a paid click's cost-per-signup. Returns the JSON to write, or
// null to leave the cookie alone.
function nextAttrPayload(existing: string | undefined, cid: string, slug: string): string | null {
  let prev: Record<string, unknown> = {};
  if (existing) {
    try {
      const parsed = JSON.parse(
        existing.trimStart().startsWith("{") ? existing : decodeURIComponent(existing)
      );
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        prev = parsed as Record<string, unknown>;
      }
    } catch {
      /* malformed = absent; attribution must not break the redirect */
    }
  }
  if (typeof prev.cid === "string" && prev.cid.trim() !== "") return null;
  return JSON.stringify({ ...prev, cid, feature: slug, ts: Date.now() });
}

// Click-tracking redirect for channel CTA buttons. Telegram can't report button
// clicks, so buttons point here: we log the click against the post, stamp the
// attribution cookie (so a later signup is credited to the channel and post),
// then 302 to the real (allowlisted) app page with UTM attached. Unknown slug →
// 404 (the allowlist is what prevents this being an open redirect).
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const dest = resolveDestination(slug);
  if (!dest) return NextResponse.json({ ok: false, reason: "unknown_destination" }, { status: 404 });

  const url = new URL(req.url);
  const postId = url.searchParams.get("p");
  if (postId) {
    try {
      await adminDb().rpc("increment_post_clicks", { post_id: postId });
    } catch {
      // Never let a logging hiccup break the user's click-through.
    }
  }

  const cid = telegramCid(slug, postId);

  // UTM only for our own app. External deep links (e.g. t.me/m/<hash>) can break
  // when query params are appended, and we can't read the UTM on the far side
  // anyway — the click is already recorded above.
  let res: NextResponse;
  if (!isAppDestination(slug)) {
    res = NextResponse.redirect(dest, 302);
  } else {
    const target = new URL(dest);
    target.searchParams.set("utm_source", "telegram");
    target.searchParams.set("utm_medium", "cta");
    if (postId) target.searchParams.set("utm_content", postId);
    // The proxy records a cid_visit touch for signed-in members when ?cid= is
    // present; anonymous visitors are covered by the cookie below instead.
    target.searchParams.set("cid", cid);
    res = NextResponse.redirect(target.toString(), 302);
  }

  // Stamp the attribution cookie signup/actions.ts reads — the signup flow
  // never looks at the URL, so without this a Telegram-origin signup lands
  // with attr_cid NULL. Scoped to .marketmakersfx.net like the marketing
  // site's writer; host-only on previews/localhost so dev cookies still stick.
  const raw = req.headers.get("cookie") ?? "";
  const existing = raw
    .split("; ")
    .find((c) => c.startsWith(`${ATTR_COOKIE}=`))
    ?.slice(ATTR_COOKIE.length + 1);
  const payload = nextAttrPayload(existing, cid, slug);
  if (payload !== null) {
    const prodHost = url.hostname.endsWith("marketmakersfx.net");
    res.cookies.set(ATTR_COOKIE, payload, {
      ...(prodHost ? { domain: ".marketmakersfx.net" } : {}),
      path: "/",
      maxAge: ATTR_MAX_AGE,
      sameSite: "lax",
      secure: prodHost,
    });
  }
  return res;
}
