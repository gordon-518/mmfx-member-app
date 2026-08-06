import { NextResponse } from "next/server";
import { adminDb } from "@/lib/channel/db";
import { resolveDestination, isAppDestination } from "@/lib/channel/destinations";

export const runtime = "nodejs";

// Click-tracking redirect for channel CTA buttons. Telegram can't report button
// clicks, so buttons point here: we log the click against the post, then 302 to
// the real (allowlisted) app page with UTM attached. Unknown slug → 404 (the
// allowlist is what prevents this being an open redirect).
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const dest = resolveDestination(slug);
  if (!dest) return NextResponse.json({ ok: false, reason: "unknown_destination" }, { status: 404 });

  const postId = new URL(req.url).searchParams.get("p");
  if (postId) {
    try {
      await adminDb().rpc("increment_post_clicks", { post_id: postId });
    } catch {
      // Never let a logging hiccup break the user's click-through.
    }
  }

  // UTM only for our own app. External deep links (e.g. t.me/m/<hash>) can break
  // when query params are appended, and we can't read the UTM on the far side
  // anyway — the click is already recorded above.
  if (!isAppDestination(slug)) {
    return NextResponse.redirect(dest, 302);
  }
  const target = new URL(dest);
  target.searchParams.set("utm_source", "telegram");
  target.searchParams.set("utm_medium", "cta");
  if (postId) target.searchParams.set("utm_content", postId);
  return NextResponse.redirect(target.toString(), 302);
}
