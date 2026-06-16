"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CourseLevel, CourseModule } from "./courseData";

// Only the fields the client needs — pptFile stays server-side (the download
// goes through /api/slides/<slug>, which maps slug -> file on the server).
export interface ClientLesson {
  slug: string;
  number: number;
  title: string;
  level: CourseLevel;
  description: string;
  gumletId: string;
}

const LS_KEY = "mmfx_course_watched_v1";
const pad = (n: number) => String(n).padStart(2, "0");

function PlayIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7L8 5Z" /></svg>;
}
function CheckIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className={`shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SlidesIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 3h7l5 5v13a0 0 0 0 1 0 0H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

export function CourseClient({
  lessons,
  modules,
}: {
  lessons: ClientLesson[];
  modules: CourseModule[];
}) {
  const [activeSlug, setActiveSlug] = useState<string>(lessons[0]?.slug ?? "");
  const [watched, setWatched] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<number>>(new Set([modules[0]?.id]));
  const playerRef = useRef<HTMLDivElement>(null);

  const active = lessons.find((l) => l.slug === activeSlug) ?? lessons[0];
  const lessonsOf = useCallback(
    (m: CourseModule) => lessons.filter((l) => l.number >= m.from && l.number <= m.to),
    [lessons]
  );
  const moduleOf = (l: ClientLesson) => modules.find((m) => l.number >= m.from && l.number <= m.to);
  const activeModuleId = active ? moduleOf(active)?.id : undefined;

  // Load saved progress, then resume at the first unwatched lesson and open
  // its module. localStorage is read in an effect to avoid hydration mismatch.
  useEffect(() => {
    let saved: string[] = [];
    try {
      saved = JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
    } catch {
      saved = [];
    }
    const seen = new Set(saved.filter((s) => lessons.some((l) => l.slug === s)));
    setWatched(seen);
    const resume = lessons.find((l) => !seen.has(l.slug)) ?? lessons[0];
    if (resume) {
      setActiveSlug(resume.slug);
      const mod = moduleOf(resume);
      if (mod) setOpen((o) => new Set(o).add(mod.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markWatched = useCallback((slug: string) => {
    setWatched((prev) => {
      if (prev.has(slug)) return prev;
      const next = new Set(prev).add(slug);
      try {
        localStorage.setItem(LS_KEY, JSON.stringify([...next]));
      } catch {
        /* storage may be unavailable — progress is best-effort */
      }
      return next;
    });
  }, []);

  const watch = useCallback(
    (slug: string) => {
      setActiveSlug(slug);
      markWatched(slug);
      const lesson = lessons.find((l) => l.slug === slug);
      const mod = lesson ? moduleOf(lesson) : undefined;
      if (mod) setOpen((o) => new Set(o).add(mod.id));
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lessons, markWatched]
  );

  const toggle = (id: number) =>
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const doneCount = watched.size;
  const total = lessons.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const resume = lessons.find((l) => !watched.has(l.slug)) ?? lessons[0];

  return (
    <div className="mx-auto max-w-5xl px-5 pb-10 pt-6 sm:px-8">
      {/* Player — only the selected lesson's iframe is mounted. */}
      {active && (
        <div ref={playerRef} className="scroll-mt-6">
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-line bg-ink shadow-soft">
            <iframe
              key={active.gumletId}
              src={`https://play.gumlet.io/embed/${active.gumletId}`}
              title={active.title}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-bold tracking-tight text-ink">
              <span className="text-orange">{pad(active.number)}</span> {active.title}
            </h2>
            <span className="text-[12px] font-semibold uppercase tracking-wide text-faint">
              {moduleOf(active)?.title} · {active.level}
            </span>
          </div>
          <p className="mt-1.5 max-w-3xl text-[14px] leading-relaxed text-subtle">{active.description}</p>
        </div>
      )}

      {/* Progress strip */}
      <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-card px-5 py-3.5 shadow-soft">
        <span className="text-[13px] font-semibold text-ink">
          {modules.length} modules · {total} lessons
        </span>
        <div className="h-1.5 min-w-[120px] flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-orange transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[12px] text-subtle">{doneCount} / {total} watched</span>
        {resume && (
          <button
            type="button"
            onClick={() => watch(resume.slug)}
            className="cursor-pointer text-[13px] font-semibold text-orange transition-colors hover:text-accent-ink"
          >
            {doneCount === 0 ? "Start course" : doneCount >= total ? "Rewatch" : "Resume"} →
          </button>
        )}
      </div>

      {/* Module syllabus */}
      <div className="mt-5 space-y-3">
        {modules.map((m) => {
          const group = lessonsOf(m);
          if (group.length === 0) return null;
          const isOpen = open.has(m.id);
          const modDone = group.filter((l) => watched.has(l.slug)).length;
          const isActiveModule = m.id === activeModuleId;

          return (
            <section
              key={m.id}
              className={`overflow-hidden rounded-2xl border bg-card shadow-soft ${
                isActiveModule ? "border-orange/30" : "border-line"
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(m.id)}
                aria-expanded={isOpen}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent-soft/30"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-[12px] font-bold text-accent-ink">
                  {m.id}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[15px] font-bold tracking-tight text-ink">{m.title}</span>
                  <span className="block text-[11px] text-faint">{m.summary}</span>
                </span>
                <span className="shrink-0 text-[11px] font-medium text-subtle">
                  {modDone}/{group.length} · {group.length} {group.length === 1 ? "lesson" : "lessons"}
                </span>
                <ChevronIcon open={isOpen} />
              </button>

              {isOpen && (
                <ul className="border-t border-line">
                  {group.map((l) => {
                    const isActive = l.slug === active?.slug;
                    const isWatched = watched.has(l.slug);
                    return (
                      <li
                        key={l.slug}
                        className={`flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 ${
                          isActive ? "bg-accent-soft/40" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => watch(l.slug)}
                          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                          aria-label={`Watch ${l.title}`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                              isActive
                                ? "bg-orange text-white"
                                : isWatched
                                  ? "bg-accent-soft text-accent-ink"
                                  : "border border-line-strong text-faint"
                            }`}
                          >
                            {isActive ? <PlayIcon /> : isWatched ? <CheckIcon /> : pad(l.number)}
                          </span>
                          <span className={`truncate text-[14px] ${isActive ? "font-semibold text-ink" : "text-ink"}`}>
                            {l.title}
                          </span>
                        </button>
                        <span className="hidden shrink-0 rounded-full bg-paper px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-subtle sm:inline">
                          {l.level}
                        </span>
                        <a
                          href={`/api/slides/${l.slug}`}
                          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-subtle transition-colors hover:text-accent-ink"
                          title="Download slides (PPT)"
                        >
                          <SlidesIcon /> <span className="hidden sm:inline">Slides</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
