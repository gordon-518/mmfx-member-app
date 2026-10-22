"use client";

import { useState } from "react";
import Link from "next/link";
import { DIMENSIONS } from "@/lib/kys/dimensions";
import type { DimensionScores } from "@/lib/kys/types";
import { CheckIcon } from "@/components/icons";

// What the member has actually built so far, on the page they open daily.
//
// The syllabus arrives as a prop: courseData.ts is server-only (it holds the
// slide filenames), so the page hands down just the slugs and titles — the
// same shape the course player already sends to the browser.
//
// Both halves are real: the lessons come from profiles.course_watched
// (20261022000003 — the member's, not this browser's), and the dimensions are
// the Know Your Style scores. Nothing here is a mock-up of progress; a member
// who has done nothing sees an empty track and the first thing to do.

export interface TrackModule {
  id: number;
  title: string;
  lessons: { slug: string; title: string }[];
}

/** A level per module finished — the only "level" with a real definition. */
function levelOf(modules: TrackModule[], done: number[]): { n: number; title: string } {
  let n = 0;
  for (let i = 0; i < modules.length; i++) {
    if (done[i] === modules[i].lessons.length) n = i + 1;
    else break;
  }
  return { n, title: n === 0 ? "Not started" : modules[n - 1].title };
}

export function SkillTrack({
  modules,
  watched,
  dimensions,
}: {
  modules: TrackModule[];
  watched: string[];
  dimensions: DimensionScores | null;
}) {
  const [openModule, setOpenModule] = useState<number | null>(null);
  const seen = new Set(watched);

  const all = modules.flatMap((m) => m.lessons);
  const perModule = modules.map((m) => m.lessons.filter((l) => seen.has(l.slug)).length);
  const totalDone = all.filter((l) => seen.has(l.slug)).length;
  const level = levelOf(modules, perModule);
  const nextLesson = all.find((l) => !seen.has(l.slug));

  const scored = dimensions
    ? DIMENSIONS.map((d) => ({ ...d, v: Number(dimensions[d.id] ?? 0) }))
    : null;
  const leak = scored ? [...scored].sort((a, b) => a.v - b.v)[0] : null;

  return (
    <section className="rise mt-10" style={{ animationDelay: "0.25s" }}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg font-bold tracking-tight text-ink">What you&apos;re building</h3>
        <Link href="/course" className="text-[13px] font-semibold text-orange transition-colors hover:text-accent-ink">
          Open the course →
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* ---------------- The system ---------------- */}
        <div className="rounded-2xl border border-line bg-card p-5 shadow-soft">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-orange">
                Level {level.n} of {modules.length}
              </p>
              <p className="mt-0.5 font-display text-[19px] font-bold tracking-tight text-ink">
                {level.title}
              </p>
            </div>
            <p className="text-[12.5px] text-subtle">
              <b className="font-display text-[15px] font-bold text-ink">{totalDone}</b> of{" "}
              {all.length} lessons
            </p>
          </div>

          {/* One segment per lesson, grouped by module — the shape of the
              syllabus and your place in it, in one row. */}
          <div className="mt-3 flex gap-1.5" aria-hidden>
            {modules.map((m, i) => {
              const count = m.lessons.length;
              return (
                <div key={m.id} className="flex flex-1 gap-0.5" style={{ flexGrow: count }}>
                  {Array.from({ length: count }, (_, k) => (
                    <span
                      key={k}
                      className={`h-2 flex-1 rounded-full ${k < perModule[i] ? "bg-orange" : "bg-line"}`}
                    />
                  ))}
                </div>
              );
            })}
          </div>

          <ul className="mt-4 flex flex-col gap-1.5">
            {modules.map((m, i) => {
              const count = m.lessons.length;
              const done = perModule[i];
              const complete = done === count;
              const isOpen = openModule === m.id;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setOpenModule(isOpen ? null : m.id)}
                    aria-expanded={isOpen}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-paper"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                        complete
                          ? "bg-orange text-white"
                          : done > 0
                            ? "bg-accent-soft text-accent-ink"
                            : "border border-line-strong text-faint"
                      }`}
                    >
                      {complete ? <CheckIcon width={12} height={12} strokeWidth={3} /> : m.id}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">{m.title}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-faint">
                      {done}/{count}
                    </span>
                  </button>
                  {isOpen && (
                    <ul className="mb-1 ml-8 flex flex-col gap-0.5 border-l border-line pl-3">
                      {m.lessons.map((l) => (
                        <li key={l.slug}>
                          <Link
                            href={`/course?lesson=${l.slug}`}
                            className="flex items-center gap-2 rounded-lg px-2 py-1 text-[12.5px] transition-colors hover:bg-paper"
                          >
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${seen.has(l.slug) ? "bg-orange" : "bg-line-strong"}`}
                              aria-hidden
                            />
                            <span className={seen.has(l.slug) ? "text-faint line-through decoration-line-strong" : "text-subtle"}>
                              {l.title}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          {nextLesson && (
            <Link
              href={`/course?lesson=${nextLesson.slug}`}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-orange px-4 py-2 text-[13px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
            >
              {totalDone === 0 ? "Start lesson 1" : "Carry on"}: {nextLesson.title}
            </Link>
          )}
        </div>

        {/* ---------------- The trader ---------------- */}
        <div className="rounded-2xl border border-line bg-card p-5 shadow-soft">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-orange">Your habits</p>
          {scored ? (
            <>
              <p className="mt-0.5 font-display text-[19px] font-bold tracking-tight text-ink">
                Six dimensions
              </p>
              <ul className="mt-3.5 flex flex-col gap-2.5">
                {scored.map((d) => (
                  <li key={d.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12px] font-semibold text-ink">{d.name}</span>
                      <span className="font-mono text-[11px] text-faint">{d.v}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line">
                      <div
                        className={`h-full rounded-full ${d.id === leak?.id ? "bg-accent-ink" : "bg-orange"}`}
                        style={{ width: `${Math.max(0, Math.min(100, d.v))}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              {leak && (
                <p className="mt-3.5 rounded-xl border border-orange/25 bg-accent-soft/50 p-3 text-[12.5px] leading-relaxed text-ink">
                  Weakest: <b className="font-semibold">{leak.name}</b> — closer to &ldquo;{leak.lowPole}&rdquo;
                  than you want.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="mt-0.5 font-display text-[19px] font-bold tracking-tight text-ink">
                Not measured yet
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-subtle">
                Know Your Style scores you on six dimensions and names the habit costing you the
                most. Six minutes, and this fills in.
              </p>
              <Link
                href="/bots/know-your-style"
                className="mt-3.5 inline-flex rounded-xl bg-orange px-4 py-2 text-[13px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
              >
                Take the assessment
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
