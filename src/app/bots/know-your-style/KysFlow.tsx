"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckIcon } from "@/components/icons";
import { questionsIn } from "@/lib/kys/questions";
import { dimensionsIn } from "@/lib/kys/dimensions";
import { ARCHETYPES, archetypeName, toArchetypeId } from "@/lib/kys/archetypes";
import { selectMoves } from "@/lib/kys/moves";
import { useT } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { rich } from "@/i18n/rich";
import { Analysing } from "./Analysing";
import { Progress, QuestionStep } from "./QuestionStep";
import { ReportView } from "./ReportView";
import type { DimensionScores, GenerateReportResponse, UserAnswers } from "@/lib/kys/types";

// Know Your Style, native (21 Oct). Previously an iframed app on its own
// Vercel project; the member app only learned the archetype if the member
// emailed themselves a copy. Now the assessment runs here, the report is
// written by /api/kys/generate-report, and the profile is saved to the
// member's row — so a returning member reads their profile back instead of
// starting from scratch.
//
// Every word is in the reader's language, the report included: the route
// writes it in the language the member takes the assessment in. The answers
// still go up as option ids, so scoring never depends on the language.

type Phase = "welcome" | "questioning" | "analysing" | "report" | "error";

export interface SavedProfile {
  archetype: string;
  dimensions: DimensionScores;
  report: string;
  takenAt: string | null;
}

export function KysFlow({ saved }: { saved: SavedProfile | null }) {
  const reduce = useReducedMotion();
  const t = useT();
  const k = t.kys;
  const questions = useMemo(() => questionsIn(t.kysQuestions), [t]);
  // A saved profile opens straight on the report; "Take it again" restarts.
  const [phase, setPhase] = useState<Phase>(saved ? "report" : "welcome");
  const [answers, setAnswers] = useState<UserAnswers>({});
  const [current, setCurrent] = useState(0);
  const [report, setReport] = useState(saved?.report ?? "");
  const [archetype, setArchetype] = useState<string | null>(saved?.archetype ?? null);
  const [dimensions, setDimensions] = useState<DimensionScores | null>(saved?.dimensions ?? null);
  const [takenAt, setTakenAt] = useState<string | null>(saved?.takenAt ?? null);
  const [error, setError] = useState("");

  // The "next move" buttons follow the reader's language, so they're derived
  // here rather than kept from the response.
  const archetypeId = toArchetypeId(archetype);
  const moves = useMemo(
    () => (archetypeId && dimensions ? selectMoves(archetypeId, dimensions, t) : []),
    [archetypeId, dimensions, t]
  );
  const whatYouGet = [
    { label: k.getArchetype, detail: fmt(k.getArchetypeDetail, { n: ARCHETYPES.length }) },
    { label: k.getDimensions, detail: k.getDimensionsDetail },
    { label: k.getLeak, detail: k.getLeakDetail },
  ];

  function restart() {
    setAnswers({});
    setCurrent(0);
    setReport("");
    setArchetype(null);
    setDimensions(null);
    setTakenAt(null);
    setError("");
    setPhase("questioning");
  }

  async function answer(optionId: string) {
    const q = questions[current];
    const next = { ...answers, [q.id]: optionId };
    setAnswers(next);

    if (current + 1 < questions.length) {
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
        // The route's own error text is for the logs; the member gets one of ours.
        setError(res.status === 401 ? k.errorSession : fmt(k.errorService, { status: res.status }));
        setPhase("error");
        return;
      }
      const data = (await res.json()) as GenerateReportResponse;
      setReport(data.report_text);
      setArchetype(data.archetype);
      setDimensions(data.dimensions);
      setTakenAt(null);
      setPhase("report");
    } catch {
      setError(k.errorNetwork);
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
          <Progress current={current + 1} total={questions.length} />
        </div>
      )}

      <AnimatePresence mode="wait">
        {phase === "welcome" && (
          <motion.div key="welcome" {...fade}>
            <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-soft">
              <div className="grid sm:grid-cols-[1.45fr_1fr]">
                <div className="p-6 sm:p-7">
                  <h2 className="font-display text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[30px]">
                    {rich(k.headline, {
                      tell: <span className="text-orange">{k.headlineTell}</span>,
                      find: <span className="whitespace-nowrap">{k.headlineFind}</span>,
                    })}
                  </h2>
                  <p className="mt-3 text-[14.5px] leading-relaxed text-subtle">{k.intro}</p>

                  <ul className="mt-5 flex flex-col gap-3">
                    {whatYouGet.map((w) => (
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
                    {k.start}
                  </button>
                  <p className="mt-3 text-[12px] text-faint">{k.savedNote}</p>
                </div>

                {/* The six spectra, named up front: it says what the questions
                    are actually measuring before anyone answers one. */}
                <aside className="border-t border-line bg-paper p-6 sm:border-l sm:border-t-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                    {k.measured}
                  </p>
                  <ul className="mt-3.5 flex flex-col gap-3">
                    {dimensionsIn(t.dimensions).map((d) => (
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
            <QuestionStep question={questions[current]} onSelect={answer} />
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
              archetypeId={archetypeId}
              archetypeName={archetypeName(archetype, t.archetypes) ?? k.fallbackName}
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
            <p className="font-display text-lg font-bold text-ink">{k.errorTitle}</p>
            <p className="mt-2 text-[14px] text-subtle">{error}</p>
            <p className="mt-1 text-[13px] text-faint">{k.errorKept}</p>
            <button
              type="button"
              onClick={() => answer(answers[questions[questions.length - 1].id])}
              className="mt-5 cursor-pointer rounded-xl bg-orange px-5 py-2.5 text-[14px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
            >
              {t.common.retry}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
