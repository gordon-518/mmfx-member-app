import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/journal/api";
import {
  GUIDE_COLUMNS,
  guideToRow,
  guideUrl,
  rowToExport,
  rowToGuide,
  type GuideRow,
} from "@/lib/guides/store";
import { parseGuide, summarize } from "@/lib/guides/validate";

// The guide index, and the brain's drop-off point (daily-guides design §2).
//
// PUBLIC and unauthenticated: this is what the marketing site's /guides page,
// its sitemap and its OG cards read, and the guides are the site's organic
// search surface — there is nothing here a reader could not see on the page.
// The table itself stays service-role only; this route is the only way out.
//
// Summaries, not guides: the index card draws the cover, the title and the
// description, and shipping every bodyMarkdown would make the list megabytes.
// The full object is one request away at /api/guides/[slug].
//
// The read still validates. A row that would not render is dropped from the
// list with a console.error rather than served half-built or 500ing the index —
// the whole index must not go down because one row went bad.
//
// Two authenticated siblings share the path: POST (the brain publishes) and
// `?format=export` (the nightly file copy — every row, both statuses).

export const dynamic = "force-dynamic";

/** The design doc's header, verbatim: five minutes fresh, an hour stale. */
const CACHE = "public, s-maxage=300, stale-while-revalidate=3600";

function authorized(req: NextRequest): boolean {
  // The brain calls this with its dedicated ORGANIC_CRON_SECRET when one is
  // set (same rule as /api/organic/*); CRON_SECRET remains the fallback.
  const secret = process.env.ORGANIC_CRON_SECRET || process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  // `?format=export` is a DIFFERENT endpoint wearing the same path (the design
  // doc asks for it there): the nightly backup, behind the bearer, every row in
  // both statuses. Checked before anything else so an unauthenticated caller
  // gets a 401 rather than quietly falling through to the public summaries —
  // which would make the export indistinguishable from the index.
  const isExport = new URL(req.url).searchParams.get("format") === "export";
  if (isExport && !authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = serviceClient();

  // The index on (status, published_on desc) serves this exactly. The second
  // order is the site loader's stable tie-break, so two guides published on the
  // same day never swap places between requests.
  let query = db.from("guides").select(GUIDE_COLUMNS);
  if (!isExport) query = query.eq("status", "published");
  const { data, error } = await query
    .order("published_on", { ascending: false })
    .order("slug", { ascending: true });

  if (error) {
    console.error(`[api/guides] ${isExport ? "export" : "list"} failed:`, error.message);
    return NextResponse.json({ error: isExport ? "export failed" : "list failed" }, { status: 500 });
  }

  if (isExport) {
    // No cache header: a backup must read the database, not a CDN copy of it.
    // rowToExport keeps a row that would not validate (and logs it) — the whole
    // point of a file copy is that it is not missing the row you need.
    const guides = ((data ?? []) as unknown as GuideRow[]).map(rowToExport);
    return NextResponse.json({ guides }, { headers: { "Cache-Control": "no-store" } });
  }

  const guides = ((data ?? []) as unknown as GuideRow[])
    .map(rowToGuide)
    .filter((g): g is NonNullable<typeof g> => g !== null)
    .map(summarize);

  return NextResponse.json({ guides }, { headers: { "Cache-Control": CACHE } });
}

/**
 * Publish a guide — bearer, the same machine-to-machine secret the spotlight
 * and variants routes use, so the brain needs no new credential.
 *
 * The body is a full GuideV2. POSTing it IS the publication: the composing, the
 * compliance gate and the first-guide-per-feature approval all happened in the
 * brain, and this route's job is only to refuse what could not have been
 * approved. So it validates against the SAME contract the marketing site
 * validates with (src/lib/guides/validate.ts is that validator, ported) and
 * answers 422 with the error list rather than storing something that would
 * render as a blank section or fail the site's own check on the way out.
 *
 * Upsert by slug, because a guide is identified by its URL: re-POSTing a slug
 * corrects the guide in place rather than creating a second one, and it is also
 * how an unpublished guide comes back (status is set to 'published' every time).
 * The response carries the live URL so the brain can put it in the Telegram
 * line and the spotlight email without rebuilding it.
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ errors: ["a JSON object is required"] }, { status: 422 });
  }

  // The slug only labels the error messages here; parseGuide is what decides
  // whether it is a slug at all.
  const raw = (body as { slug?: unknown }).slug;
  const { guide, errors } = parseGuide(typeof raw === "string" ? raw : "body", body);
  if (!guide) return NextResponse.json({ errors }, { status: 422 });

  const db = serviceClient();
  const { error } = await db
    .from("guides")
    .upsert({ ...guideToRow(guide), status: "published" }, { onConflict: "slug" });

  if (error) {
    console.error(`[api/guides] upsert of "${guide.slug}" failed:`, error.message);
    return NextResponse.json({ error: "upsert failed" }, { status: 500 });
  }

  return NextResponse.json({ slug: guide.slug, url: guideUrl(guide.slug) });
}
