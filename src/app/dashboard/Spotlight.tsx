"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowIcon } from "@/components/icons";

export interface SpotlightSlide {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: { label: string; href: string };
  image: {
    src: string;
    alt: string;
    /** "contain" shows a designed graphic (e.g. an analysis cover) in full;
     * "cover" (default) fills the panel for photographs. */
    fit?: "cover" | "contain";
    /** Dark panel — pair with a dark-background graphic so contain letterbox
     * bars blend in. */
    dark?: boolean;
  };
}

const AUTO_MS = 7000;

/**
 * The dashboard spotlight — one large featured block that rotates through the
 * timely things (latest analysis, next live class, the course). Manual dots
 * plus a gentle auto-advance that pauses on hover/focus and is disabled under
 * prefers-reduced-motion. A single slide renders statically (no dots).
 */
export function Spotlight({ slides }: { slides: SpotlightSlide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = slides.length;
  const active = slides[Math.min(i, count - 1)];

  useEffect(() => {
    if (count <= 1 || paused) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setInterval(() => setI((p) => (p + 1) % count), AUTO_MS);
    return () => clearInterval(t);
  }, [count, paused]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="overflow-hidden rounded-2xl border border-line bg-card shadow-soft"
    >
      <div className="flex flex-col sm:flex-row">
        {/* Image panel */}
        <div
          className={`relative h-44 w-full shrink-0 sm:h-auto sm:w-[42%] sm:max-w-[340px] ${
            active.image.dark ? "bg-ink" : "bg-accent-soft"
          }`}
        >
          <Image
            key={active.image.src}
            src={active.image.src}
            alt={active.image.alt}
            fill
            sizes="(max-width: 640px) 100vw, 340px"
            className={active.image.fit === "contain" ? "object-contain" : "object-cover"}
          />
        </div>

        {/* Content */}
        <div key={active.key} className="flex min-w-0 flex-1 flex-col justify-center p-6 sm:p-8">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
            {active.eyebrow}
          </p>
          <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-ink">
            {active.title}
          </h2>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-subtle">
            {active.body}
          </p>

          <div className="mt-5 flex items-center gap-4">
            <Link
              href={active.cta.href}
              className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-orange px-5 py-3 text-[14px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
            >
              {active.cta.label} <ArrowIcon width={16} height={16} />
            </Link>

            {count > 1 && (
              <div className="flex items-center gap-1.5" role="tablist" aria-label="Choose featured slide">
                {slides.map((s, idx) => {
                  const on = idx === i;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      aria-label={`Show ${s.title}`}
                      onClick={() => setI(idx)}
                      className={`h-1.5 cursor-pointer rounded-full transition-all ${
                        on ? "w-5 bg-orange" : "w-1.5 bg-line-strong hover:bg-faint"
                      }`}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
