import { requireFull } from "@/lib/access";
import { AppShell } from "@/components/AppShell";
import { LESSONS, MODULES } from "./courseData";
import { CourseClient, type ClientLesson } from "./CourseClient";

export default async function CoursePage() {
  // Gate: Limited users redirect to /upgrade, signed-out to /login.
  const profile = await requireFull();

  // Pass only client-needed fields (pptFile stays server-side).
  const lessons: ClientLesson[] = LESSONS.map((l) => ({
    slug: l.slug,
    number: l.number,
    title: l.title,
    level: l.level,
    description: l.description,
    gumletId: l.gumletId,
  }));

  return (
    <AppShell email={profile.email} accountStatus={profile.account_status} tier="Full">
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
      </div>

      <CourseClient lessons={lessons} modules={MODULES} />
    </AppShell>
  );
}
