"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { QUESTIONS } from "@/lib/kys/questions";
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
    <div className="mx-auto w-full max-w-2xl">
      {phase === "questioning" && (
        <div className="mb-6">
          <Progress current={current + 1} total={QUESTIONS.length} />
        </div>
      )}

      <AnimatePresence mode="wait">
        {phase === "welcome" && (
          <motion.div key="welcome" {...fade} className="py-6 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-orange">
              Trader profiling · 14 questions · 6 min
            </p>
            <h2 className="mx-auto mt-3 max-w-[34rem] font-display text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
              Every trader has a <span className="text-orange">tell.</span> Let&apos;s find yours.
            </h2>
            <p className="mx-auto mt-4 max-w-[28rem] text-[15px] leading-relaxed text-subtle">
              Answer honestly. At the end you get a written breakdown of your style, your edge, and
              the exact leak costing you money. No fluff.
            </p>
            <div className="mt-7 flex justify-center gap-8">
              {[
                { n: "14", l: "questions" },
                { n: "~6", l: "minutes" },
                { n: "1", l: "honest report" },
              ].map((s) => (
                <div key={s.l} className="text-[11px] tracking-wide text-faint">
                  <span className="block font-display text-lg font-bold text-ink">{s.n}</span>
                  {s.l}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPhase("questioning")}
              className="mt-8 cursor-pointer rounded-xl bg-orange px-8 py-3.5 font-display text-[15px] font-bold text-white shadow-soft transition-transform hover:-translate-y-0.5"
            >
              Start the assessment →
            </button>
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
            className="rounded-2xl border border-line bg-card p-6 text-center shadow-soft"
          >
            <p className="font-display text-lg font-bold text-ink">That didn&apos;t finish.</p>
            <p className="mt-2 text-[14px] text-subtle">{error}</p>
            <p className="mt-1 text-[13px] text-faint">Your answers are still here — try again.</p>
            <button
              type="button"
              onClick={() => answer(answers[QUESTIONS[QUESTIONS.length - 1].id])}
              className="mt-5 cursor-pointer rounded-xl bg-orange px-5 py-2.5 font-display text-[14px] font-bold text-white shadow-soft"
            >
              Try again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
