"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { SpectrumBars } from "./SpectrumBars";
import { ReportMarkdown } from "./ReportMarkdown";
import { buildResultEmailHtml } from "@/lib/kys/resultEmail";
import { ROUTES } from "@/lib/kys/routing";
import type { DimensionScores, Move } from "@/lib/kys/types";

// The finished profile. Native now (21 Oct): the "next move" buttons are real
// in-app links instead of postMessage navigation, and "Send me a copy" calls
// our own route directly instead of handing the result up through an iframe.

function SendCopy({
  archetypeName,
  dimensions,
  markdown,
}: {
  archetypeName: string;
  dimensions: DimensionScores;
  markdown: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  async function send() {
    setState("sending");
    try {
      const res = await fetch("/api/kys/send-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The route emails the LOGGED-IN account; it never takes an address
        // from here.
        body: JSON.stringify({
          archetype: archetypeName,
          resultHtml: buildResultEmailHtml({ archetypeName, dimensions, markdown }),
        }),
      });
      setState(res.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  }

  if (state === "sent") {
    return <p className="mt-4 text-[13px] text-subtle">Sent — check your inbox.</p>;
  }
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={send}
        disabled={state === "sending"}
        className="cursor-pointer rounded-xl border border-line-strong bg-card px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-orange/40 hover:text-accent-ink disabled:cursor-wait disabled:opacity-70"
      >
        {state === "sending" ? "Sending your copy…" : "Send me a copy"}
      </button>
      {state === "failed" && (
        <p className="mt-2 text-[12.5px] text-accent-ink">
          That didn&apos;t send. Your profile is saved — try again from here any time.
        </p>
      )}
    </div>
  );
}

export function ReportView({
  archetypeName,
  dimensions,
  markdown,
  moves,
  takenAt,
  onRetake,
}: {
  archetypeName: string;
  dimensions: DimensionScores;
  markdown: string;
  moves: Move[];
  /** Set when this is a saved profile being read back, not a fresh result. */
  takenAt?: string | null;
  onRetake: () => void;
}) {
  const reduce = useReducedMotion();
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
      <div className="text-center">
        <motion.p {...rise(0)} className="text-[11px] font-semibold uppercase tracking-[0.3em] text-orange">
          Your trading style
        </motion.p>
        <motion.h2
          {...rise(0.12)}
          className="mt-2.5 font-display text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl"
        >
          {archetypeName}
        </motion.h2>
        <motion.span
          {...(reduce ? {} : { initial: { scaleX: 0 }, animate: { scaleX: 1 }, transition: { duration: 0.5, delay: 0.4 } })}
          className="mx-auto mt-4 block h-0.5 w-20 origin-center rounded-full bg-orange"
        />
        {takenAt && (
          <p className="mt-3 text-[12.5px] text-faint">
            Taken {new Date(takenAt).toISOString().slice(0, 10)} · your saved profile
          </p>
        )}
        <SendCopy archetypeName={archetypeName} dimensions={dimensions} markdown={markdown} />
      </div>

      <motion.article
        {...rise(0.5)}
        className="mt-7 rounded-2xl border border-line bg-card p-6 shadow-soft sm:p-7"
      >
        <h3 className="font-display text-[17px] font-bold tracking-tight text-ink">Your profile</h3>
        <p className="mb-5 mt-1 text-[13px] leading-relaxed text-subtle">
          Six dimensions of how you trade. You&apos;re not one thing — this is the full shape, and
          your weakest are where the money leaks.
        </p>
        <SpectrumBars scores={dimensions} />

        <hr className="my-7 border-line" />

        <ReportMarkdown markdown={markdown} />
      </motion.article>

      {moves.length > 0 && (
        <div className="mt-8">
          <h3 className="flex items-center font-display text-lg font-bold text-ink">
            <span aria-hidden className="mr-2.5 inline-block h-2 w-2 rounded-[2px] bg-orange" />
            Your next moves
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
                  {ROUTES[m.path]?.label ?? "Open"} →
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] text-faint">
            Chosen from your archetype and your two weakest dimensions
          </p>
        </div>
      )}

      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={onRetake}
          className="cursor-pointer text-[13px] font-semibold text-subtle underline underline-offset-4 transition-colors hover:text-accent-ink"
        >
          Take it again
        </button>
      </div>
    </div>
  );
}
