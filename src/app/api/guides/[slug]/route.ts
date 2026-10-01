import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/journal/api";
import { GUIDE_COLUMNS, rowToGuide, type GuideRow } from "@/lib/guides/store";

// One guide (daily-guides design §2).
//
// GET is PUBLIC and returns the full guide JSON v2 object, keys exactly as the
// contract names them — this response IS what the site's `getGuide(slug)`
// hands to its renderer, so a key spelled differently here is a blank section
// there. Same cache header as the index.
//
// 404 covers three cases on purpose: no such slug, an unpublished slug, and a
// stored row that does not validate. All three mean "there is no page here",
// and the third must not be a 500: a guide whose row went bad takes its own URL
// down, nothing else. rowToGuide logs the reason.
//
// DELETE is the brain's withdraw, behind the same bearer as POST. It never
// deletes a row.

export const dynamic = "force-dynamic";

/** The design doc's header, verbatim: five minutes fresh, an hour stale. */
const CACHE = "public, s-maxage=300, stale-while-revalidate=3600";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function authorized(req: NextRequest): boolean {
  // The brain calls this with its dedicated ORGANIC_CRON_SECRET when one is
  // set (same rule as /api/organic/*); CRON_SECRET remains the fallback.
  const secret = process.env.ORGANIC_CRON_SECRET || process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

const notFound = () =>
  NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": CACHE } });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // A slug the table could not hold is not worth a query.
  if (!SLUG_RE.test(slug)) return notFound();

  const db = serviceClient();
  const { data, error } = await db
    .from("guides")
    .select(GUIDE_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error(`[api/guides/${slug}] read failed:`, error.message);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!data) return notFound();

  const guide = rowToGuide(data as unknown as GuideRow);
  if (!guide) return notFound();

  return NextResponse.json(guide, { headers: { "Cache-Control": CACHE } });
}

/**
 * Withdraw a guide — bearer, and never a delete.
 *
 * `status = 'unpublished'` because the slug is already named by rows that
 * outlive the guide: attribution_touches carries `SEO-guide-<slug>`,
 * email_sends names the spotlight that linked to it, and the brain's topic
 * backlog records it against a used topic. A store that cannot say what a
 * withdrawn guide said is not a store. Re-POSTing the slug republishes it.
 *
 * Idempotent: unpublishing an already-unpublished guide is a 200, because the
 * caller asked for a state and that is the state. Only a slug the table has
 * never held is a 404.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "slug must be lowercase kebab-case" }, { status: 400 });
  }

  const db = serviceClient();
  const { data, error } = await db
    .from("guides")
    .update({ status: "unpublished" })
    .eq("slug", slug)
    .select("slug");

  if (error) {
    console.error(`[api/guides/${slug}] unpublish failed:`, error.message);
    return NextResponse.json({ error: "unpublish failed" }, { status: 500 });
  }
  if (!(data ?? []).length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, slug, status: "unpublished" });
}
