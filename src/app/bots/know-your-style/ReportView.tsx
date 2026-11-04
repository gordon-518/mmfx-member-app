"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { SpectrumBars } from "./SpectrumBars";
import { ReportMarkdown } from "./ReportMarkdown";
import { buildResultEmailHtml } from "@/lib/kys/resultEmail";
import { ROUTES } from "@/lib/kys/routing";
import type { ArchetypeId, DimensionScores, Move } from "@/lib/kys/types";
import { useT } from "@/i18n/client";
import { fmt } from "@/i18n/format";

// The finished profile. Native now (21 Oct): the "next move" buttons are real
// in-app links instead of postMessage navigation, and "Send me a copy" calls
// our own route directly instead of handing the result up through an iframe.

/** A report always carries its language's first heading, so a missing one means another language. */
function writtenInAnotherLanguage(markdown: string, firstHeading: string): boolean {
  return !markdown.split("\n").some((line) => line.trim().startsWith(`## ${firstHeading}`));
}

function SendCopy({
  archetypeId,
  archetypeName,
  dimensions,
  markdown,
}: {
  archetypeId: ArchetypeId;
  archetypeName: string;
  dimensions: DimensionScores;
  markdown: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const t = useT();
  const k = t.kys;

  async function send() {
    setState("sending");
    try {
      const res = await fetch("/api/kys/send-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The route emails the LOGGED-IN account; it never takes an address
        // from here. The archetype goes up as its ID: the route records it on
        // the profile, which must hold the ID, never a (translated) name.
        body: JSON.stringify({
          archetype: archetypeId,
          resultHtml: buildResultEmailHtml({ archetypeName, dimensions, markdown, words: t }),
        }),
      });
      setState(res.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  }

  if (state === "sent") {
    return <p className="mt-4 text-[13px] text-subtle">{k.sent}</p>;
  }
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={send}
        disabled={state === "sending"}
        className="cursor-pointer rounded-xl border border-line-strong bg-card px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-orange/40 hover:text-accent-ink disabled:cursor-wait disabled:opacity-70"
      >
        {state === "sending" ? k.sending : k.sendCopy}
      </button>
      {state === "failed" && <p className="mt-2 text-[12.5px] text-accent-ink">{k.sendFailed}</p>}
    </div>
  );
}

export function ReportView({
  archetypeId,
  archetypeName,
  dimensions,
  markdown,
  moves,
  takenAt,
  onRetake,
}: {
  /** Null only for a saved archetype we no longer recognise: then there's no copy to send. */
  archetypeId: ArchetypeId | null;
  archetypeName: string;
  dimensions: DimensionScores;
  markdown: string;
  moves: Move[];
  /** Set when this is a saved profile being read back, not a fresh result. */
  takenAt?: string | null;
  onRetake: () => void;
}) {
  const reduce = useReducedMotion();
  const t = useT();
  const k = t.kys;
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] as const, delay },
        };

  return (
    <div className="w-full">
      {/* The result reads as a panel in the app, not a landing-page hero:
          same card, same left-aligned eyebrow/title as every other page. */}
      <motion.header
        {...rise(0)}
        className="rounded-2xl border border-line bg-card p-6 shadow-soft sm:p-7"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-orange">{k.yourStyle}</p>
        <motion.h2
          {...rise(0.12)}
          className="mt-1.5 font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-[34px]"
        >
          {archetypeName}
        </motion.h2>
        <motion.span
          {...(reduce ? {} : { initial: { scaleX: 0 }, animate: { scaleX: 1 }, transition: { duration: 0.5, delay: 0.4 } })}
          className="mt-3.5 block h-0.5 w-16 origin-left rounded-full bg-orange"
        />
        {takenAt && (
          <p className="mt-3 text-[12.5px] text-faint">
            {fmt(k.taken, { date: new Date(takenAt).toISOString().slice(0, 10) })}
          </p>
        )}
        {archetypeId && (
          <SendCopy archetypeId={archetypeId} archetypeName={archetypeName} dimensions={dimensions} markdown={markdown} />
        )}
      </motion.header>

      <motion.article
        {...rise(0.5)}
        className="mt-5 rounded-2xl border border-line bg-card p-6 shadow-soft sm:p-7"
      >
        <h3 className="font-display text-[17px] font-bold tracking-tight text-ink">{k.profileTitle}</h3>
        <p className="mb-5 mt-1 text-[13px] leading-relaxed text-subtle">{k.profileBody}</p>
        <SpectrumBars scores={dimensions} />

        <hr className="my-7 border-line" />

        <ReportMarkdown markdown={markdown} />
      </motion.article>

      {moves.length > 0 && (
        <div className="mt-8">
          <h3 className="flex items-center font-display text-lg font-bold text-ink">
            <span aria-hidden className="mr-2.5 inline-block h-2 w-2 rounded-[2px] bg-orange" />
            {k.nextMoves}
          </h3>
          <div className="mt-3 flex flex-col gap-2.5">
            {moves.map((m) => (
              <Link
                key={m.path}
                href={m.path}
                className={
                  m.primary
                    ? "group flex items-center gap-3.5 rounded-xl border border-orange bg-orange px-4 py-3.5 text-white shadow-soft transition-transform hover:-translate-y-0.5"
                    : "group flex items-center gap-3.5 rounded-xl border border-line bg-card px-4 py-3.5 text-ink shadow-soft transition-colors hover:border-orange/40"
                }
              >
                <span className="min-w-0">
                  <b className="block font-display text-[14px] font-bold leading-snug">{m.label}</b>
                  <span className={`text-[12px] leading-snug ${m.primary ? "text-white/85" : "text-subtle"}`}>
                    {m.why}
                  </span>
                </span>
                <span
                  className={`ml-auto shrink-0 whitespace-nowrap font-mono text-[11px] ${
                    m.primary ? "text-white/80" : "text-faint"
                  }`}
                >
                  {ROUTES[m.path] ? t.nav[ROUTES[m.path].navKey] : t.common.open} →
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-faint">{k.movesNote}</p>
        </div>
      )}

      <div className="mt-8">
        {writtenInAnotherLanguage(markdown, t.kysReport.read) && (
          <p className="mb-2 max-w-xl text-[12.5px] leading-relaxed text-faint">{k.reportLanguageNote}</p>
        )}
        <button
          type="button"
          onClick={onRetake}
          className="cursor-pointer text-[13px] font-semibold text-subtle underline underline-offset-4 transition-colors hover:text-accent-ink"
        >
          {k.retake}
        </button>
      </div>
    </div>
  );
}
