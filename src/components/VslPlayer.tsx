"use client";

import { useState } from "react";

// Click-to-play video, in the house style.
//
// Nothing is fetched until someone presses play: there is no <video> element
// on the page until then, and the cover is drawn rather than a poster image,
// so a member who never presses play pays nothing for a 31 MB file.
//
// The file is served from the marketing site (one copy, one CDN) rather than
// committed here a second time. Cross-origin <video> needs no CORS headers —
// we never read its pixels.

export function VslPlayer({
  src,
  title,
  eyebrow = "Watch it work",
  duration,
}: {
  src: string;
  title: string;
  eyebrow?: string;
  /** e.g. "2:30" — so the length is known before anyone commits to it. */
  duration?: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-ink">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={src}
          controls
          autoPlay
          playsInline
          preload="metadata"
          aria-label={title}
          className="absolute inset-0 h-full w-full object-contain"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group relative flex aspect-video w-full cursor-pointer flex-col items-start justify-end gap-2 overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-[#1a1714] via-[#241d18] to-[#2e231a] p-5 text-left shadow-soft transition-all hover:border-orange/50 hover:shadow-soft-lg"
    >
      <span className="absolute left-5 top-4 text-[10px] font-bold uppercase tracking-[0.1em] text-white/55">
        {eyebrow}
      </span>
      <span
        aria-hidden
        className="flex h-[54px] w-[54px] items-center justify-center rounded-full border border-white/25 bg-ink/55 text-white backdrop-blur transition-colors group-hover:border-orange group-hover:bg-orange"
      >
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M9 7.5v9l7.5-4.5z" />
        </svg>
      </span>
      <span className="font-display text-[17px] font-bold leading-tight tracking-tight text-white">
        {title}
      </span>
      {duration && (
        <span className="text-[11.5px] font-semibold uppercase tracking-wide text-white/50">
          {duration}
        </span>
      )}
      <span className="sr-only">Play the video: {title}</span>
    </button>
  );
}
