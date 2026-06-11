"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { CourseLevel } from "./courseData";

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

const LEVELS: CourseLevel[] = ["Basic", "Intermediate", "Advanced"];

export function CourseClient({ lessons }: { lessons: ClientLesson[] }) {
  const [activeSlug, setActiveSlug] = useState<string>(lessons[0]?.slug ?? "");
  const playerRef = useRef<HTMLDivElement>(null);
  const active = lessons.find((l) => l.slug === activeSlug) ?? lessons[0];

  function watch(slug: string) {
    setActiveSlug(slug);
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:px-10">
      {/* Single player area — only the selected lesson's iframe is mounted. */}
      {active && (
        <div ref={playerRef} className="scroll-mt-6">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-pearl/10 bg-obsidian">
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
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-semibold text-pearl">
              <span className="text-orange">{String(active.number).padStart(2, "0")}</span>{" "}
              {active.title}
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
              Now playing · {active.level}
            </span>
          </div>
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted">
            {active.description}
          </p>
        </div>
      )}

      {/* Lessons grouped by level */}
      {LEVELS.map((level) => {
        const group = lessons.filter((l) => l.level === level);
        if (group.length === 0) return null;
        return (
          <section key={level} className="mt-12">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.28em] text-orange/80">
              {level} · {group.length}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.map((l) => {
                const isActive = l.slug === active?.slug;
                return (
                  <article
                    key={l.slug}
                    className={`flex flex-col overflow-hidden rounded-lg border bg-graphite/70 ${
                      isActive ? "border-orange/60" : "border-pearl/10"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => watch(l.slug)}
                      className="group relative block aspect-video w-full bg-obsidian text-left"
                      aria-label={`Watch ${l.title}`}
                    >
                      <Image
                        src={`/course/${l.slug}.png`}
                        alt={`${l.title} thumbnail`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-opacity group-hover:opacity-80"
                      />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-pearl/40 bg-obsidian/60 font-mono text-pearl backdrop-blur-sm transition-colors group-hover:border-orange group-hover:text-orange">
                          ▶
                        </span>
                      </span>
                      <span className="absolute left-2 top-2 border border-pearl/15 bg-obsidian/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
                        {level}
                      </span>
                    </button>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="font-display text-base font-semibold text-pearl">
                        <span className="text-muted">
                          {String(l.number).padStart(2, "0")}
                        </span>{" "}
                        {l.title}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted">
                        {l.description}
                      </p>
                      <div className="mt-4 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => watch(l.slug)}
                          className="border border-orange/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-orange transition-colors hover:bg-orange hover:text-black"
                        >
                          {isActive ? "Playing" : "Watch"}
                        </button>
                        <a
                          href={`/api/slides/${l.slug}`}
                          className="border border-pearl/20 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:border-orange/60 hover:text-pearl"
                        >
                          Slides (PPT) ↓
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
