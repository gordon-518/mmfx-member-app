"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { CloseIcon } from "@/components/icons";
import { TOUR_STEPS } from "./steps";
import { TOUR_EVENT } from "./startTour";

// The "how to use" tour: a spotlight over the real interface, so a new member
// learns where things are by looking at the actual menu rather than at a
// picture of it. It lives inside AppShell because the sidebar is the thing
// being pointed at — on a phone that sidebar is a drawer, so the tour asks the
// shell to open it before pointing.
//
// A stop whose target isn't on screen (a page without it, a member without
// that element) is skipped rather than shown pointing at nothing.

const PAD = 8;
const CARD_W = 340;
const GAP = 14;
const CARD_H = 215; // rough, for choosing a side — the card itself auto-sizes
const MOBILE = 640;
const NAV_BREAKPOINT = 1024; // lg: the sidebar stops being a drawer

function findTarget(target?: string): HTMLElement | null {
  if (!target) return null;
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`));
  // The nav is rendered twice (sidebar + drawer); take whichever is visible.
  return all.find((el) => el.getBoundingClientRect().width > 0) ?? null;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function GuidedTour({
  open,
  onClose,
  onNavOpen,
}: {
  open: boolean;
  onClose: () => void;
  onNavOpen: (open: boolean) => void;
}) {
  const [i, setI] = useState(0);
  // Keyed by step so a measurement can never be shown against the wrong one,
  // which also means the effect never has to clear it synchronously.
  const [spot, setSpot] = useState<{ key: string; box: Box } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = TOUR_STEPS[i];

  // No mounted guard: `open` only turns true from a window event, so the
  // portal is never reached while rendering on the server.

  const finish = useCallback(
    (completed: boolean) => {
      onNavOpen(false);
      onClose();
      setI(0);
      if (completed) {
        // Same store as roadmap_seen — no migration, and it survives devices.
        createClient()
          .auth.updateUser({ data: { tour_done: true } })
          .catch(() => {
            /* a flag that fails to save just means they see it offered again */
          });
      }
    },
    [onClose, onNavOpen]
  );

  // Point at the current step: open the drawer if the target lives in it,
  // bring the target into view, then measure. Anything we can't find gets
  // skipped, which is how the nav stops behave on pages that lack them.
  useEffect(() => {
    if (!open || !step?.target) return;
    const narrow = window.innerWidth < NAV_BREAKPOINT;
    if (step.inNav && narrow) onNavOpen(true);
    else if (!step.inNav) onNavOpen(false);

    let cancelled = false;
    let misses = 0;
    const measure = () => {
      if (cancelled) return;
      const el = findTarget(step.target);
      if (!el) {
        // Give it one more frame before giving up — a drawer mid-animation or
        // a page mid-hydration isn't the same as a target that isn't there.
        if (++misses < 3) {
          window.setTimeout(measure, 180);
          return;
        }
        // Nothing to point at: move on rather than show an orphaned card.
        setI((n) => (n + 1 < TOUR_STEPS.length ? n + 1 : n));
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) {
        el.scrollIntoView({ block: "center", behavior: "auto" });
      }
      const b = el.getBoundingClientRect();
      setSpot({ key: step.key, box: { top: b.top, left: b.left, width: b.width, height: b.height } });
    };
    // One frame for the drawer to mount, then measure and keep up with scroll.
    const t = window.setTimeout(measure, step.inNav && narrow ? 340 : 30);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
    // `finish` deliberately isn't a dependency: it isn't used here, and it
    // changes identity on every render, which would cancel the timer above
    // before it ever fired.
  }, [open, step, onNavOpen]);

  // Keyboard: Escape leaves, arrows move.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
      if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, TOUR_STEPS.length - 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, finish]);

  useEffect(() => {
    if (open) cardRef.current?.focus();
  }, [open, i]);

  if (!open || !step) return null;

  const box = step.target && spot?.key === step.key ? spot.box : null;
  const last = i === TOUR_STEPS.length - 1;
  const narrowCard = typeof window !== "undefined" && window.innerWidth < MOBILE;

  // Card placement: under the target if it fits, over it if not, and a bottom
  // sheet on a phone where neither is comfortable.
  let cardStyle: React.CSSProperties = {};
  if (!box || narrowCard) {
    cardStyle = box
      ? { left: 16, right: 16, bottom: 16 }
      : { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "min(360px, calc(100vw - 32px))" };
  } else {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const below = box.top + box.height + GAP;
    const rightOf = box.left + box.width + GAP;
    // A tall target (the whole sidebar, say) has no room above or below, and
    // a card placed there would cover the thing it is pointing at. Those go
    // beside it instead.
    if (box.height > vh * 0.55 && rightOf + CARD_W + 12 < vw) {
      cardStyle = {
        left: rightOf,
        top: Math.min(Math.max(12, box.top + box.height / 2 - CARD_H / 2), vh - CARD_H - 12),
        width: CARD_W,
      };
    } else {
      const left = Math.min(Math.max(12, box.left), vw - CARD_W - 12);
      cardStyle =
        below + CARD_H < vh
          ? { top: below, left, width: CARD_W }
          : { top: Math.max(12, box.top - CARD_H - GAP), left, width: CARD_W };
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="How to use the app">
      {/* The dimmer, with the target cut out of it. */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id="mmfx-tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {box && (
              <rect
                x={box.left - PAD}
                y={box.top - PAD}
                width={box.width + PAD * 2}
                height={box.height + PAD * 2}
                rx="14"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(26,23,20,0.55)"
          mask="url(#mmfx-tour-mask)"
        />
      </svg>
      {/* Clicking the dimmer leaves the tour. */}
      <button
        type="button"
        aria-label="Close the tour"
        onClick={() => finish(false)}
        className="absolute inset-0 h-full w-full cursor-default"
      />

      {box && (
        <span
          aria-hidden
          className="pointer-events-none absolute rounded-[14px] ring-2 ring-orange"
          style={{
            top: box.top - PAD,
            left: box.left - PAD,
            width: box.width + PAD * 2,
            height: box.height + PAD * 2,
          }}
        />
      )}

      <div
        ref={cardRef}
        tabIndex={-1}
        style={cardStyle}
        className="absolute rounded-2xl border border-line bg-card p-5 shadow-soft-lg outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-orange">
            Step {i + 1} of {TOUR_STEPS.length}
          </p>
          <button
            type="button"
            onClick={() => finish(false)}
            aria-label="Close the tour"
            className="-mr-1 -mt-1 cursor-pointer rounded-lg p-1 text-faint transition-colors hover:bg-paper hover:text-ink"
          >
            <CloseIcon width={16} height={16} />
          </button>
        </div>

        <h2 className="mt-1 font-display text-[18px] font-bold tracking-tight text-ink">
          {step.title}
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-subtle">{step.body}</p>

        <div className="mt-3 flex gap-1" aria-hidden>
          {TOUR_STEPS.map((s, n) => (
            <span
              key={s.key}
              className={`h-1 flex-1 rounded-full ${n <= i ? "bg-orange" : "bg-line"}`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          {i > 0 && (
            <button
              type="button"
              onClick={() => setI(i - 1)}
              className="cursor-pointer rounded-xl border border-line-strong bg-card px-3.5 py-2 text-[13px] font-semibold text-subtle transition-colors hover:border-orange/40 hover:text-ink"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (last ? finish(true) : setI(i + 1))}
            className="cursor-pointer rounded-xl bg-orange px-4 py-2 text-[13px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
          >
            {last ? "Finish" : "Next"}
          </button>
          {!last && (
            <button
              type="button"
              onClick={() => finish(false)}
              className="ml-auto cursor-pointer text-[12.5px] font-semibold text-faint transition-colors hover:text-subtle"
            >
              Skip
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Mounted by AppShell: listens for startTour() and runs the overlay. */
export function TourHost({ onNavOpen }: { onNavOpen: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const start = () => setOpen(true);
    window.addEventListener(TOUR_EVENT, start);
    return () => window.removeEventListener(TOUR_EVENT, start);
  }, []);
  // Stable, so the overlay's effects aren't torn down on every render.
  const close = useCallback(() => setOpen(false), []);
  return <GuidedTour open={open} onClose={close} onNavOpen={onNavOpen} />;
}
