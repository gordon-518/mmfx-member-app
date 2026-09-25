import { NextRequest, NextResponse } from "next/server";
import { partnerDb } from "@/lib/partners/client";
import { resolvePartner } from "@/lib/partners/auth";
import { fetchFunnel, parseRange, parseRule, toCsv } from "@/lib/partners/funnel";

// The dashboard's CSV (design 2026-09-25 §2.6). The documented parameter is
// ?format=csv on /partners/<slug>; a page cannot set a Content-Type, so it
// redirects here with the same query and this route answers with the file.
//
// Same key, same 404, same rows as the page — literally the same functions.

export const dynamic = "force-dynamic";

function one(v: string | null): string | undefined {
  return v ?? undefined;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params;
  const q = req.nextUrl.searchParams;

  const partner = await resolvePartner(partnerDb(), slug, q.get("key"));
  if (!partner) return new NextResponse("Not found", { status: 404 });

  const range = parseRange({
    days: one(q.get("days")),
    since: one(q.get("since")),
    until: one(q.get("until")),
  });
  const rule = parseRule(one(q.get("rule")));

  const rows = await fetchFunnel(partnerDb(), {
    slug: partner.slug,
    since: range.since,
    until: range.until,
    rule,
  });

  const day = range.until.toISOString().slice(0, 10);
  return new NextResponse(toCsv(rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${partner.slug}-funnel-${day}.csv"`,
      // A key in the URL must not be cached anywhere but the reader's tab.
      "Cache-Control": "no-store, private",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
