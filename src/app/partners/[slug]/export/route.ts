import { NextRequest, NextResponse } from "next/server";
import { partnerDb } from "@/lib/partners/client";
import { resolvePartner } from "@/lib/partners/auth";
import { fetchFunnel, parseRange, parseRule, toCsv } from "@/lib/partners/funnel";
import { clientsCsv, fetchAllSponsorClients, fetchSponsorFunnel, funnelCsv, parseSponsorRange } from "@/lib/sponsors/funnel";
import { dealStart, fetchWindows } from "@/lib/sponsors/windows";

// The dashboard's CSV (design 2026-09-25 §2.6; sponsors 2026-11-05 §4). The
// documented parameter is ?format=csv on /partners/<slug>; a page cannot set a
// Content-Type, so it redirects here with the same query and this route
// answers with the file. For a sponsor, ?table=clients is the masked client
// table and anything else is the funnel.
//
// Same key, same 404, same rows as the page — literally the same functions.

export const dynamic = "force-dynamic";

function one(v: string | null): string | undefined {
  return v ?? undefined;
}

function csvResponse(body: string, filename: string): NextResponse {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // A key in the URL must not be cached anywhere but the reader's tab.
      "Cache-Control": "no-store, private",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params;
  const q = req.nextUrl.searchParams;

  const db = partnerDb();
  const partner = await resolvePartner(db, slug, q.get("key"));
  if (!partner) return new NextResponse("Not found", { status: 404 });

  if (partner.kind === "sponsor") {
    const windows = await fetchWindows(db, partner.slug);
    const range = parseSponsorRange({ days: one(q.get("days")) }, dealStart(windows));
    const args = { slug: partner.slug, since: range.since, until: range.until };
    const day = range.until.toISOString().slice(0, 10);
    if (q.get("table") === "clients") {
      return csvResponse(clientsCsv(await fetchAllSponsorClients(db, args)), `${partner.slug}-clients-${day}.csv`);
    }
    return csvResponse(funnelCsv(await fetchSponsorFunnel(db, args)), `${partner.slug}-funnel-${day}.csv`);
  }

  const range = parseRange({
    days: one(q.get("days")),
    since: one(q.get("since")),
    until: one(q.get("until")),
  });
  const rule = parseRule(one(q.get("rule")));

  const rows = await fetchFunnel(db, {
    slug: partner.slug,
    since: range.since,
    until: range.until,
    rule,
  });

  const day = range.until.toISOString().slice(0, 10);
  return csvResponse(toCsv(rows), `${partner.slug}-funnel-${day}.csv`);
}
