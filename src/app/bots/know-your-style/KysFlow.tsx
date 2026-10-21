"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckIcon } from "@/components/icons";
import { QUESTIONS } from "@/lib/kys/questions";
import { DIMENSIONS } from "@/lib/kys/dimensions";
import { ARCHETYPES } from "@/lib/kys/archetypes";
import { selectMoves } from "@/lib/kys/moves";
import { Analysing } from "./Analysing";
import { Progress, QuestionStep } from "./QuestionStep";
import { ReportView } from "./ReportView";
import type {
  ArchetypeId,
  DimensionScores,
  GenerateReportResponse,
  Move,
  UserAnswers,
} from "@/lib/kys/types";

// Know Your Style, native (21 Oct). Previously an iframed app on its own
// Vercel project; the member app only learned the archetype if the member
// emailed themselves a copy. Now the assessment runs here, the report is
// written by /api/kys/generate-report, and the profile is saved to the
// member's row — so a returning member reads their profile back instead of
// starting from scratch.

type Phase = "welcome" | "questioning" | "analysing" | "report" | "error";

const WHAT_YOU_GET = [
  { label: "Your archetype —", detail: "which of eight trader types you actually are." },
  { label: "Your six dimensions —", detail: "where you sit on each spectrum, scored from your answers." },
  { label: "Your leak —", detail: "the weakest one, and what it is costing you." },
] as const;

function archetypeName(id: ArchetypeId | string): string {
  return ARCHETYPES.find((a) => a.id === id)?.name ?? "Your trader profile";
}

export interface SavedProfile {
  archetype: string;
  dimensions: DimensionScores;
  report: string;
  takenAt: string | null;
}

export function KysFlow({ saved }: { saved: SavedProfile | null }) {
  const reduce = useReducedMotion();
  // A saved profile opens straight on the report; "Take it again" restarts.
  const [phase, setPhase] = useState<Phase>(saved ? "report" : "welcome");
  const [answers, setAnswers] = useState<UserAnswers>({});
  const [current, setCurrent] = useState(0);
  const [report, setReport] = useState(saved?.report ?? "");
  const [archetype, setArchetype] = useState<string | null>(saved?.archetype ?? null);
  const [dimensions, setDimensions] = useState<DimensionScores | null>(saved?.dimensions ?? null);
  const [moves, setMoves] = useState<Move[]>(
    saved ? selectMoves(saved.archetype as ArchetypeId, saved.dimensions) : []
  );
  const [takenAt, setTakenAt] = useState<string | null>(saved?.takenAt ?? null);
  const [error, setError] = useState("");

  function restart() {
    setAnswers({});
    setCurrent(0);
    setReport("");
    setArchetype(null);
    setDimensions(null);
    setMoves([]);
    setTakenAt(null);
    setError("");
    setPhase("questioning");
  }

  async function answer(optionId: string) {
    const q = QUESTIONS[current];
    const next = { ...answers, [q.id]: optionId };
    setAnswers(next);

    if (current + 1 < QUESTIONS.length) {
      setCurrent(current + 1);
      return;
    }

    setPhase("analysing");
    try {
      // The archetype is scored server-side from these answers, so the client
      // can't choose its own result.
      const res = await fetch("/api/kys/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `The report service returned ${res.status}.`);
        setPhase("error");
        return;
      }
      const data = (await res.json()) as GenerateReportResponse;
      setReport(data.report_text);
      setArchetype(data.archetype);
      setDimensions(data.dimensions);
      setMoves(data.moves ?? []);
      setTakenAt(null);
      setPhase("report");
    } catch {
      setError("We couldn't reach the report service. Check your connection and try again.");
      setPhase("error");
    }
  }

  const fade = reduce
    ? {}
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.3 } };

  return (
    <div className="w-full max-w-3xl">
      {phase === "questioning" && (
        <div className="mb-6">
          <Progress current={current + 1} total={QUESTIONS.length} />
        </div>
      )}

      <AnimatePresence mode="wait">
        {phase === "welcome" && (
          <motion.div key="welcome" {...fade}>
            <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-soft">
              <div className="grid sm:grid-cols-[1.45fr_1fr]">
                <div className="p-6 sm:p-7">
                  <h2 className="font-display text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[30px]">
                    Every trader has a <span className="text-orange">tell.</span>{" "}
                    <span className="whitespace-nowrap">Let&apos;s find yours.</span>
                  </h2>
                  <p className="mt-3 text-[14.5px] leading-relaxed text-subtle">
                    Fourteen questions, about six minutes. Answer them honestly — the report is
                    only as good as what you tell it.
                  </p>

                  <ul className="mt-5 flex flex-col gap-3">
                    {WHAT_YOU_GET.map((w) => (
                      <li key={w.label} className="flex gap-3">
                        <span
                          aria-hidden
                          className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-ink"
                        >
                          <CheckIcon width={13} height={13} strokeWidth={2.4} />
                        </span>
                        <span className="text-[13.5px] leading-snug">
                          <b className="font-semibold text-ink">{w.label}</b>{" "}
                          <span className="text-subtle">{w.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => setPhase("questioning")}
                    className="mt-6 cursor-pointer rounded-xl bg-orange px-5 py-2.5 text-[14px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
                  >
                    Start the assessment →
                  </button>
                  <p className="mt-3 text-[12px] text-faint">
                    Saved to your profile — you can come back to it any time.
                  </p>
                </div>

                {/* The six spectra, named up front: it says what the questions
                    are actually measuring before anyone answers one. */}
                <aside className="border-t border-line bg-paper p-6 sm:border-l sm:border-t-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                    What gets measured
                  </p>
                  <ul className="mt-3.5 flex flex-col gap-3">
                    {DIMENSIONS.map((d) => (
                      <li key={d.id}>
                        <span className="block text-[13px] font-semibold leading-snug text-ink">
                          {d.name}
                        </span>
                        <span className="text-[11.5px] text-faint">
                          {d.lowPole} → {d.highPole}
                        </span>
                      </li>
                    ))}
                  </ul>
                </aside>
              </div>
            </section>
          </motion.div>
        )}

        {phase === "questioning" && (
          <motion.div key={`q-${current}`} {...fade}>
            <QuestionStep question={QUESTIONS[current]} onSelect={answer} />
          </motion.div>
        )}

        {phase === "analysing" && (
          <motion.div key="analysing" {...fade}>
            <Analysing />
          </motion.div>
        )}

        {phase === "report" && archetype && dimensions && (
          <motion.div key="report" {...fade}>
            <ReportView
              archetypeName={archetypeName(archetype)}
              dimensions={dimensions}
              markdown={report}
              moves={moves}
              takenAt={takenAt}
              onRetake={restart}
            />
          </motion.div>
        )}

        {phase === "error" && (
          <motion.div
            key="error"
            {...fade}
            className="rounded-2xl border border-line bg-card p-6 shadow-soft"
          >
            <p className="font-display text-lg font-bold text-ink">That didn&apos;t finish.</p>
            <p className="mt-2 text-[14px] text-subtle">{error}</p>
            <p className="mt-1 text-[13px] text-faint">Your answers are still here — try again.</p>
            <button
              type="button"
              onClick={() => answer(answers[QUESTIONS[QUESTIONS.length - 1].id])}
              className="mt-5 cursor-pointer rounded-xl bg-orange px-5 py-2.5 text-[14px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
            >
              Try again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
