import Link from "next/link";
import { MODULES, LESSONS } from "@/app/course/courseData";

// What the course actually teaches, as a track. Each module's width is its
// share of the 19 lessons, so the shape of the syllabus is visible at a
// glance: most of the weight sits in the entry model and in managing the
// trade, which is the point the roadmap keeps making.
//
// Only module 1 can be marked from the server (fn_my_onboarding's lesson1);
// the player keeps the rest in the browser. So this shows the syllabus and
// marks the start, and never pretends to know more than it does.

export function CourseTrack({ startedModule1 }: { startedModule1: boolean }) {
  const counts = MODULES.map((m) => m.to - m.from + 1);
  const total = counts.reduce((a, b) => a + b, 0);

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-soft sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-orange">
        What the course teaches
      </p>
      <h3 className="mt-1.5 font-display text-[19px] font-bold tracking-tight text-ink">
        {LESSONS.length} lessons, in {MODULES.length} steps
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-subtle">
        From the mindset to the entry model to managing the open position. Each block below is a
        module — its width is how much of the course it takes up.
      </p>

      <div className="mt-4 flex gap-1 overflow-hidden rounded-lg" aria-hidden>
        {MODULES.map((m, i) => (
          <span
            key={m.id}
            style={{ flexGrow: counts[i] }}
            className={`h-2.5 rounded-sm ${i === 0 && startedModule1 ? "bg-orange" : "bg-line"}`}
          />
        ))}
      </div>

      <ol className="mt-4 flex flex-col gap-2">
        {MODULES.map((m, i) => (
          <li key={m.id} className="flex items-center gap-3">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                i === 0 && startedModule1 ? "bg-orange text-white" : "bg-accent-soft text-accent-ink"
              }`}
            >
              {m.id}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold leading-snug text-ink">{m.title}</span>
              <span className="block text-[12px] leading-snug text-faint">{m.summary}</span>
            </span>
            <span className="shrink-0 font-mono text-[11px] text-faint">
              {counts[i]} {counts[i] === 1 ? "lesson" : "lessons"}
            </span>
          </li>
        ))}
      </ol>

      <Link
        href="/course"
        className="mt-4 inline-flex text-[13px] font-semibold text-accent-ink underline underline-offset-4 transition-colors hover:text-orange"
      >
        {startedModule1 ? "Carry on with the course" : `Start with lesson 1 of ${total}`} →
      </Link>
    </section>
  );
}
