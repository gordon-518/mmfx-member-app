"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Question } from "@/lib/kys/types";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G"];

/** Segmented progress: done segments solid, the current one fills. */
export function Progress({ current, total }: { current: number; total: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex items-center gap-4">
      <div className="whitespace-nowrap font-display text-[13px] font-bold tracking-wide">
        <span className="text-xl text-orange">{String(current).padStart(2, "0")}</span>
        <span className="text-faint"> / {String(total).padStart(2, "0")}</span>
      </div>
      <div className="flex flex-1 gap-1.5">
        {Array.from({ length: total }).map((_, i) => {
          const done = i < current - 1;
          const active = i === current - 1;
          return (
            <div key={i} className="relative h-1 flex-1 overflow-hidden rounded-full bg-line">
              {(done || active) && (
                <motion.div
                  className="absolute inset-0 origin-left rounded-full bg-orange"
                  initial={{ scaleX: done || reduce ? 1 : 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: active && !reduce ? 0.5 : 0, ease: "easeOut" }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const list = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } };
const item = {
  hidden: { opacity: 0, x: -24 },
  show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] as const } },
};

export function QuestionStep({
  question,
  onSelect,
}: {
  question: Question;
  onSelect: (optionId: string) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="w-full">
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange">
        {question.theme ?? "Question"}
      </p>
      <h2 className="mb-6 font-display text-[24px] font-bold leading-tight tracking-tight text-ink sm:text-[28px]">
        {question.text}
      </h2>

      <motion.div
        variants={reduce ? undefined : list}
        initial={reduce ? undefined : "hidden"}
        animate={reduce ? undefined : "show"}
        className="flex flex-col gap-2.5"
      >
        {question.options.map((o, i) => (
          <motion.button
            key={o.id}
            type="button"
            variants={reduce ? undefined : item}
            onClick={() => onSelect(o.id)}
            whileTap={reduce ? undefined : { scale: 0.985 }}
            className="group flex cursor-pointer items-center rounded-xl border border-line bg-card px-4 py-3.5 text-left text-[14.5px] font-medium text-ink shadow-soft transition-colors hover:border-orange/50"
          >
            <span className="mr-3 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-soft font-mono text-[11px] text-accent-ink transition-colors group-hover:bg-orange group-hover:text-white">
              {LETTERS[i]}
            </span>
            <span>{o.text}</span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
