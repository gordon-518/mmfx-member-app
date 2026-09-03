// Harvestable source atoms for the marketing brain's organic content agent.
// Bearer CRON_SECRET, same posture as /api/organic/attribution and /api/cron/*.
//
// Assembles the five sources that live in THIS app. The Fundamental Desk
// (api.marketmakersfx.net) and the KYS taxonomy are read by the brain directly —
// they are not this app's data.
//
// Fields are picked EXPLICITLY, never spread. courseData's Lesson carries pptFile
// (private Storage object names) and gumletId; neither may ever reach this response.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getNews, getEconomicCalendar } from "@/lib/forexNews";
import { MODULES, LESSONS } from "@/app/course/courseData";
import { EBOOKS } from "@/app/library/ebooks";

export const dynamic = "force-dynamic";

type Atom = { kind: string; id: string; evergreen?: boolean } & Record<string, unknown>;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const since = req.nextUrl.searchParams.get("since");
  const sinceIso = since ?? new Date(Date.now() - 7 * 864e5).toISOString();
  if (Number.isNaN(Date.parse(sinceIso))) {
    return NextResponse.json({ error: "bad since" }, { status: 400 });
  }

  const atoms: Atom[] = [];

  // 1. Daily Analysis — published entries only.
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: analyses } = await supabase
      .from("daily_analysis")
      .select("id,published_on,title,description,bias,session_tag")
      .eq("is_published", true)
      .gte("published_on", sinceIso.slice(0, 10))
      .order("published_on", { ascending: false })
      .limit(20);
    for (const a of analyses ?? []) {
      atoms.push({
        kind: "daily_analysis",
        id: String(a.id),
        publishedOn: a.published_on,
        title: a.title,
        description: a.description,
        bias: a.bias,
        sessionTag: a.session_tag,
      });
    }
  } catch {
    /* fail-soft */
  }

  // 2. News. Fail-soft: an upstream outage must not empty the feed and starve
  //    the content queue.
  try {
    const news = await getNews();
    for (const n of news.slice(0, 30)) {
      atoms.push({
        kind: "news",
        id: n.url,
        title: n.title,
        text: n.text,
        source: n.source,
        sentiment: n.sentiment,
        topics: n.topics,
        date: n.date,
      });
    }
  } catch {
    /* fail-soft */
  }

  // 3. Economic calendar — high-impact only, the content-worthy subset.
  try {
    const events = await getEconomicCalendar(0);
    for (const e of events.filter((x) => x.importance === "High")) {
      atoms.push({
        kind: "calendar",
        id: `${e.currency}:${e.event}:${e.date}`,
        event: e.event,
        currency: e.currency,
        date: e.date,
        importance: e.importance,
        forecast: e.forecast,
        previous: e.previous,
      });
    }
  } catch {
    /* fail-soft */
  }

  // 4. Course — evergreen, one atom per lesson, carrying its module.
  //    pptFile and gumletId are deliberately NOT included.
  for (const lesson of LESSONS) {
    const mod = MODULES.find((m) => lesson.number >= m.from && lesson.number <= m.to);
    atoms.push({
      kind: "course",
      id: `lesson-${lesson.number}`,
      evergreen: true,
      module: mod?.title ?? "",
      moduleSummary: mod?.summary ?? "",
      lesson: lesson.title,
      description: lesson.description,
      level: lesson.level,
    });
  }

  // 5. eBooks — evergreen.
  for (const b of EBOOKS) {
    atoms.push({
      kind: "ebook",
      id: b.slug,
      evergreen: true,
      book: b.title,
      category: b.category,
      blurb: b.blurb,
      whatsInside: b.whatsInside ?? [],
    });
  }

  return NextResponse.json({ since: sinceIso, count: atoms.length, atoms });
}
