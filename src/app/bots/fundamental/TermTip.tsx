"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ResolvedTerm } from "@/lib/fa/glossary/types";

/** Card width on wider screens, and its gap from the word and the viewport edge. */
const CARD_W = 320;
const GAP = 8;

export interface TermTipLabels {
  whatItMeans: string;
  howItMoves: string;
  close: string;
}

// One underlined term in the desk's text. Tap (or Enter) opens a small card:
// what it means, and how it moves this instrument. On a phone the card sits
// at the bottom of the screen so it never runs off the edge. The card lives in
// a portal: the desk's panels animate in with a transform, and a card inside
// one would be painted over by the next panel.

/** Words in the lower part of the screen open their card upwards. */
const FLIP_AT = 0.55;

type Pos = { top: string; bottom: string; left: string } | null;

export function TermTip({ text, term, labels }: { text: string; term: ResolvedTerm; labels: TermTipLabels }) {
  const [pos, setPos] = useState<Pos>(null);
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLSpanElement>(null);
  const id = useId();

  const toggle = () => {
    const r = button.current?.getBoundingClientRect();
    if (r) {
      const up = r.bottom > window.innerHeight * FLIP_AT;
      setPos({
        top: up ? "auto" : `${r.bottom + GAP}px`,
        bottom: up ? `${window.innerHeight - r.top + GAP}px` : "auto",
        left: `${Math.max(GAP, Math.min(r.left, window.innerWidth - CARD_W - GAP))}px`,
      });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!button.current?.contains(target) && !card.current?.contains(target)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
        className="cursor-help rounded-sm underline decoration-orange/60 decoration-dotted decoration-2 underline-offset-[3px] transition-colors hover:decoration-orange focus-visible:outline-2 focus-visible:outline-orange"
      >
        {text}
      </button>
      {open && pos && createPortal(
        <span
          ref={card}
          id={id}
          role="dialog"
          aria-label={term.name}
          style={{ "--tip-top": pos.top, "--tip-bottom": pos.bottom, "--tip-left": pos.left } as React.CSSProperties}
          className="fixed inset-x-4 bottom-4 z-[60] block rounded-2xl border border-line bg-card p-4 text-left shadow-soft sm:inset-x-auto sm:bottom-[var(--tip-bottom)] sm:left-[var(--tip-left)] sm:top-[var(--tip-top)] sm:w-80"
        >
          <span className="flex items-start justify-between gap-3">
            <span className="block font-display text-[14px] font-bold text-ink">{term.name}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={labels.close}
              className="-mr-1 -mt-1 rounded-full px-2 text-[18px] leading-none text-faint hover:text-ink"
            >
              ×
            </button>
          </span>
          <span className="mt-2 block text-[11px] font-semibold uppercase tracking-wider text-faint">{labels.whatItMeans}</span>
          <span className="mt-0.5 block text-[13px] font-normal leading-relaxed text-ink">{term.what}</span>
          <span className="mt-2.5 block text-[11px] font-semibold uppercase tracking-wider text-orange">{labels.howItMoves}</span>
          <span className="mt-0.5 block text-[13px] font-normal leading-relaxed text-ink">{term.moves}</span>
        </span>,
        document.body
      )}
    </>
  );
}
