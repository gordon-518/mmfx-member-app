import Link from "next/link";
import { requireFull } from "@/lib/access";
import { LESSONS } from "./courseData";
import { CourseClient, type ClientLesson } from "./CourseClient";

export default async function CoursePage() {
  // Gate: Limited users redirect to /upgrade, signed-out to /login.
  await requireFull();

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
    <main className="relative min-h-screen overflow-hidden bg-obsidian">
      {/* Atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="session-grid absolute inset-0" />
        <div className="absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-orange/10 blur-[150px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange/40 to-transparent" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between border-b border-pearl/10 px-6 py-5 sm:px-10">
        <Link href="/dashboard" className="flex items-baseline gap-3">
          <span className="font-display text-lg font-bold tracking-tight text-pearl">
            MARKET MAKERS <span className="text-orange">FX</span>
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.28em] text-muted sm:inline">
            Course
          </span>
        </Link>
        <Link
          href="/dashboard"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-orange"
        >
          ← Desk
        </Link>
      </header>

      {/* Header */}
      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-10 sm:px-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-orange/80">
          Education · {LESSONS.length} Lessons
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-pearl sm:text-4xl">
          MM Mentorship
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          The full curriculum, Basic to Advanced. Watch each lesson and pull
          its slide deck. Pick up wherever you left off.
        </p>
      </div>

      <div className="relative z-10">
        <CourseClient lessons={lessons} />
      </div>
    </main>
  );
}
