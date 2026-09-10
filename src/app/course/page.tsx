import Link from "next/link";
import { requireFeature } from "@/lib/access";
import { canWatchLesson } from "@/lib/access/course";
import { AppShell } from "@/components/AppShell";
import { LockedFeature } from "@/components/LockedFeature";
import { LESSONS, MODULES } from "./courseData";
import { CourseClient, type ClientLesson } from "./CourseClient";

export default async function CoursePage() {
  // Gate (conversion-fix 2.2): signed-out -> /login. Free users get Module 1
  // (2.3); every other lesson is locked individually below.
  const gate = await requireFeature("course");
  if (gate.locked) return <LockedFeature feature="course" gate={gate} />;
  const { profile, viewer } = gate;

  // Pass only client-needed fields (pptFile stays server-side). A locked
  // lesson's video id is withheld as well, so its player can't be loaded.
  const lessons: ClientLesson[] = LESSONS.map((l) => {
    const open = canWatchLesson(l.number, MODULES, viewer);
    return {
      slug: l.slug,
      number: l.number,
      title: l.title,
      level: l.level,
      description: l.description,
      gumletId: open ? l.gumletId : "",
      locked: !open,
    };
  });
  const lockedCount = lessons.filter((l) => l.locked).length;

  return (
    <AppShell email={profile.email} accountStatus={profile.account_status} tier={gate.tier} isAdmin={profile.is_admin}>
      {/* Header */}
      <div className="mx-auto max-w-5xl px-5 pt-8 sm:px-8 lg:pt-10">
        <div className="rise">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
            Education · {LESSONS.length} Lessons
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">
            MM Mentorship
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">
            The full curriculum, Basic to Advanced. Watch each lesson and pull
            its slide deck. Pick up wherever you left off.
          </p>
        </div>

        {lockedCount > 0 && (
          <div className="rise mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange/25 bg-accent-soft/40 px-5 py-3.5">
            <p className="text-[13.5px] leading-relaxed text-ink">
              <span className="font-semibold">Module 1 is open on your plan.</span>{" "}
              The other {lockedCount} lessons unlock when you fund your account.
            </p>
            <Link
              href="/upgrade"
              className="text-[13px] font-semibold text-orange transition-colors hover:text-accent-ink"
            >
              See how →
            </Link>
          </div>
        )}
      </div>

      <CourseClient lessons={lessons} modules={MODULES} />
    </AppShell>
  );
}
