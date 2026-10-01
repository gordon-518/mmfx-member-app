import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/journal/api";
import { GUIDE_COLUMNS, rowToGuide, type GuideRow } from "@/lib/guides/store";
import { summarize } from "@/lib/guides/validate";

// The guide index (daily-guides design §2).
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

export const dynamic = "force-dynamic";

/** The design doc's header, verbatim: five minutes fresh, an hour stale. */
const CACHE = "public, s-maxage=300, stale-while-revalidate=3600";

export async function GET(_req: NextRequest) {
  const db = serviceClient();

  // The index on (status, published_on desc) serves this exactly. The second
  // order is the site loader's stable tie-break, so two guides published on the
  // same day never swap places between requests.
  const { data, error } = await db
    .from("guides")
    .select(GUIDE_COLUMNS)
    .eq("status", "published")
    .order("published_on", { ascending: false })
    .order("slug", { ascending: true });

  if (error) {
    console.error("[api/guides] list failed:", error.message);
    return NextResponse.json({ error: "list failed" }, { status: 500 });
  }

  const guides = ((data ?? []) as unknown as GuideRow[])
    .map(rowToGuide)
    .filter((g): g is NonNullable<typeof g> => g !== null)
    .map(summarize);

  return NextResponse.json({ guides }, { headers: { "Cache-Control": CACHE } });
}
