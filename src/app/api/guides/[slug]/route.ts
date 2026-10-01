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

export const dynamic = "force-dynamic";

/** The design doc's header, verbatim: five minutes fresh, an hour stale. */
const CACHE = "public, s-maxage=300, stale-while-revalidate=3600";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
