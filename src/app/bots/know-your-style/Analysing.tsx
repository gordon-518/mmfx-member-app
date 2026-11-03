"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ARCHETYPES } from "@/lib/kys/archetypes";
import { useT } from "@/i18n/client";
import { fmt } from "@/i18n/format";

// The report takes a few seconds to write. Saying what it's doing beats a
// spinner that implies nothing is happening.
const STEP_KEYS = ["s1", "s2", "s3", "s4", "s5"] as const;
const STEP_MS = 1600;

export function Analysing() {
  const [step, setStep] = useState(0);
  const reduce = useReducedMotion();
  const words = useT().kys.analysing;

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % STEP_KEYS.length), STEP_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-card py-12 text-center shadow-soft">
      <div className="relative h-24 w-24">
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-orange/25 border-t-orange"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
        />
        <motion.span
          className="absolute inset-3 rounded-full border-2 border-line border-b-line-strong"
          animate={reduce ? undefined : { rotate: -360 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
        />
        <motion.span
          className="absolute inset-0 m-auto h-3 w-3 rounded-full bg-orange"
          animate={reduce ? undefined : { scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="mt-7 h-6">
        <AnimatePresence mode="wait">
          <motion.p
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="font-mono text-[13px] tracking-wide text-subtle"
          >
            {fmt(words[STEP_KEYS[step]], { n: ARCHETYPES.length })}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
