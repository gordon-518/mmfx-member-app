import Link from "next/link";
import { requireFeature } from "@/lib/access";
import { canWatchLesson } from "@/lib/access/course";
import { AppShell } from "@/components/AppShell";
import { LockedFeature } from "@/components/LockedFeature";
import { createClient } from "@/lib/supabase/server";
import { LESSONS, MODULES } from "./courseData";
import { CourseClient, type ClientLesson } from "./CourseClient";
import { getLocale, getT } from "@/i18n/server";
import { fmt } from "@/i18n/format";
import { lessonText, levelLabel, moduleText } from "@/i18n/course";
import { VslTour } from "@/components/VslPlayer";

export default async function CoursePage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  // Gate (conversion-fix 2.2): signed-out -> /login. Free users get Module 1
  // (2.3); every other lesson is locked individually below.
  const gate = await requireFeature("course");
  if (gate.locked) return <LockedFeature feature="course" gate={gate} />;
  const { profile, viewer } = gate;
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const c = t.course;

  // Pass only client-needed fields (pptFile stays server-side). A locked
  // lesson's video id is withheld as well, so its player can't be loaded.
  // Progress the member made anywhere, so the player resumes in the right
  // place on a second device (20261022000003). Own row via RLS.
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("profiles")
    .select("course_watched")
    .eq("id", profile.id)
    .maybeSingle();
  const savedWatched = (row?.course_watched as string[] | null) ?? [];

  // ?lesson=<slug> opens that lesson (the dashboard's track links straight to
  // one). Validated against the real set, so an unknown or locked slug falls
  // back to the normal resume point instead of opening nothing.
  const { lesson: requested } = await searchParams;

  // Titles, levels and module names in the reader's language.
  const lessons: ClientLesson[] = LESSONS.map((l) => {
    const open = canWatchLesson(l.number, MODULES, viewer);
    const text = lessonText(t, l.slug, l);
    return {
      slug: l.slug,
      number: l.number,
      title: text.title,
      level: levelLabel(t, l.level),
      description: text.description,
      gumletId: open ? l.gumletId : "",
      locked: !open,
    };
  });
  const lockedCount = lessons.filter((l) => l.locked).length;
  const modules = MODULES.map((m) => ({ ...m, ...moduleText(t, m.id, m) }));

  return (
    <AppShell email={profile.email} accountStatus={profile.account_status} memberTier={gate.viewer.tier} isAdmin={profile.is_admin}>
      {/* Header */}
      <div className="mx-auto max-w-5xl px-5 pt-8 sm:px-8 lg:pt-10">
        <div className="rise">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
            {fmt(c.eyebrow, { n: LESSONS.length })}
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">{c.title}</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">{c.subtitle}</p>
          {locale !== "en" && <p className="mt-1.5 text-[12.5px] text-faint">{c.contentNote}</p>}
          <VslTour videos={[{ video: "course" }]} />
        </div>

        {lockedCount > 0 && (
          <div className="rise mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange/25 bg-accent-soft/40 px-5 py-3.5">
            <p className="text-[13.5px] leading-relaxed text-ink">
              <span className="font-semibold">{c.module1Open}</span>{" "}
              {fmt(viewer.noMentorship ? c.otherMentorship : c.otherFund, { n: lockedCount })}
            </p>
            <Link
              href="/upgrade"
              className="text-[13px] font-semibold text-orange transition-colors hover:text-accent-ink"
            >
              {c.seeHow}
            </Link>
          </div>
        )}
      </div>

      <CourseClient
        lessons={lessons}
        modules={modules}
        savedWatched={savedWatched}
        initialLesson={lessons.find((l) => l.slug === requested && !l.locked)?.slug ?? null}
      />
    </AppShell>
  );
}
