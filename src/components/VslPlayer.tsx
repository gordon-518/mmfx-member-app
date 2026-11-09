"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useT } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { vslSources, type VslKey } from "@/lib/vsl";

// Click-to-play feature videos, in the house style.
//
// Nothing is fetched until someone presses play: there is no <video> element
// until then, and the cover is drawn rather than a poster image, so a member
// who never presses play pays nothing for the file.
//
// Two cuts (src/lib/vsl.ts): 16:9 from the sm breakpoint up, 4:5 below it, so
// a phone plays the cut whose words were set for a phone. The cover takes the
// same shape, and the cut is picked at the moment play is pressed.

const WIDE = "(min-width: 640px)";
type Cut = "wide" | "tall";

function pickCut(): Cut {
  return window.matchMedia(WIDE).matches ? "wide" : "tall";
}

function Video({ video, cut, title }: { video: VslKey; cut: Cut; title: string }) {
  const t = useT();
  const src = vslSources(video);
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  // Bumped by "Try again", which mounts a fresh <video> for the same file.
  const [attempt, setAttempt] = useState(0);
  // The button that started it has gone; keep keyboard focus on the player.
  useEffect(() => {
    ref.current?.focus();
  }, [attempt]);

  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-ink sm:aspect-video">
      {failed ? (
        // A file that won't load (offline, or a version not uploaded) says so,
        // instead of leaving a black box with dead controls.
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center">
          <p className="text-[14px] font-medium text-white/80">{t.vsl.failed}</p>
          <button
            type="button"
            autoFocus
            onClick={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
            className="rounded-full border border-white/25 px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:border-orange hover:bg-orange"
          >
            {t.common.retry}
          </button>
        </div>
      ) : (
        <video
          key={attempt}
          ref={ref}
          src={cut === "wide" ? src.wide : src.tall}
          controls
          autoPlay
          playsInline
          preload="metadata"
          aria-label={title}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-contain"
        />
      )}
    </div>
  );
}

function PlayIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M9 7.5v9l7.5-4.5z" />
    </svg>
  );
}

/** "1 min", or "1 min · in English" where the page isn't. */
function useMeta(): string {
  const t = useT();
  return useLocale() === "en" ? t.vsl.length : `${t.vsl.length} · ${t.vsl.inEnglish}`;
}

/** The full player: a drawn cover the size of the video, for a page whose job is to show the feature. */
export function VslPlayer({ video, eyebrow }: { video: VslKey; eyebrow?: string }) {
  const t = useT();
  const meta = useMeta();
  const [cut, setCut] = useState<Cut | null>(null);
  const title = t.vsl.titles[video];

  if (cut) return <Video video={video} cut={cut} title={title} />;

  return (
    <button
      type="button"
      onClick={() => setCut(pickCut())}
      // One name, not every line of the cover read out (the title twice).
      aria-label={fmt(t.vsl.play, { title })}
      className="group relative flex aspect-[4/5] w-full cursor-pointer flex-col items-start justify-end gap-2 overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-[#1a1714] via-[#241d18] to-[#2e231a] p-5 text-left shadow-soft transition-all hover:border-orange/50 hover:shadow-soft-lg sm:aspect-video"
    >
      <span className="absolute left-5 top-4 text-[10px] font-bold uppercase tracking-[0.1em] text-white/55">
        {eyebrow ?? t.vsl.eyebrow}
      </span>
      <span
        aria-hidden
        className="flex h-[54px] w-[54px] items-center justify-center rounded-full border border-white/25 bg-ink/55 text-white backdrop-blur transition-colors group-hover:border-orange group-hover:bg-orange"
      >
        <PlayIcon size={26} />
      </span>
      <span className="font-display text-[17px] font-bold leading-tight tracking-tight text-white">{title}</span>
      <span className="text-[11.5px] font-semibold uppercase tracking-wide text-white/50">{meta}</span>
    </button>
  );
}

/**
 * The quiet version for a page members use every day: one pill per video
 * under the page's intro, and the player only once one is pressed. Close puts
 * the pills back.
 */
export function VslTour({ videos }: { videos: { video: VslKey; label?: string }[] }) {
  const t = useT();
  const meta = useMeta();
  const [open, setOpen] = useState<{ video: VslKey; cut: Cut } | null>(null);
  // Close hands focus back to the pill that opened the video.
  const [closed, setClosed] = useState<VslKey | null>(null);

  if (open) {
    return (
      <div className="mt-4 max-w-[640px]">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="font-display text-[14px] font-bold tracking-tight text-ink">{t.vsl.titles[open.video]}</p>
          <button
            type="button"
            onClick={() => {
              setClosed(open.video);
              setOpen(null);
            }}
            className="rounded-full border border-line px-3 py-1 text-[12px] font-medium text-subtle transition-colors hover:border-orange/40 hover:text-ink"
          >
            {t.common.close}
          </button>
        </div>
        <Video video={open.video} cut={open.cut} title={t.vsl.titles[open.video]} />
      </div>
    );
  }

  return (
    <div className="mt-3.5 flex flex-wrap gap-2">
      {videos.map(({ video, label }) => (
        <button
          key={video}
          type="button"
          onClick={() => setOpen({ video, cut: pickCut() })}
          autoFocus={closed === video}
          // Starts with the words on the pill, so "click Watch the tour" works by voice.
          aria-label={fmt(t.vsl.tourLabel, { label: label ?? t.vsl.tour, title: t.vsl.titles[video] })}
          className="group inline-flex items-center gap-2 rounded-full border border-line bg-card py-1.5 pl-1.5 pr-3.5 text-[12.5px] font-semibold text-ink shadow-soft transition-colors hover:border-orange/40"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white transition-colors group-hover:bg-orange">
            <PlayIcon size={14} />
          </span>
          {label ?? t.vsl.tour}
          <span className="font-medium text-faint">· {meta}</span>
        </button>
      ))}
    </div>
  );
}
