"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckIcon, ExternalIcon, TelegramIcon } from "@/components/icons";
import {
  onboardingProgress,
  deskPitchFor,
  type OnboardingKey,
  type OnboardingState,
} from "@/lib/onboarding";
import { markChannelOpened } from "./actions";

// "Start here", rebuilt as a roadmap (Gordon, 22 Oct): every task carries the
// goal it unlocks and the target to hit after it, and the member opens one at
// a time instead of reading six cards at once. Progress is real — it comes
// from fn_my_onboarding, which reads each step from where it happens — so
// nothing here can be ticked off by wishful clicking. The one exception is the
// channel: Telegram can't tell us about a join, so the click is what's
// recorded, and the copy says "Opened", never "Joined".

function Ring({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : done / total;
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[72px] w-[72px] shrink-0">
      <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden className="-rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--color-line)" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="var(--color-orange)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-[15px] font-bold text-ink">
        {done}
        <span className="text-faint">/{total}</span>
      </span>
    </div>
  );
}

export function StartHere({
  state,
  archetype,
}: {
  state: OnboardingState;
  archetype?: string | null;
}) {
  const reduce = useReducedMotion();
  // The channel click is recorded server-side, but the page was rendered
  // before it happened — hold it here so the step ticks over immediately.
  const [channelOpened, setChannelOpened] = useState(false);
  const live: OnboardingState = channelOpened ? { ...state, telegram: true } : state;
  const p = onboardingProgress(live);
  const [open, setOpen] = useState<OnboardingKey | null>(p.next?.key ?? null);

  async function openChannel() {
    setChannelOpened(true);
    await markChannelOpened();
  }

  return (
    <section>
      <p className="text-[13px] font-semibold uppercase tracking-wider text-orange">Start here</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Your first six steps
      </h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-subtle">
        One a day. Each one opens the next, and each says what you should be able to do once
        it&apos;s behind you.
      </p>

      <div className="mt-6 flex items-center gap-5 rounded-2xl border border-line bg-card p-5 shadow-soft">
        <Ring done={p.doneCount} total={p.total} />
        <div className="min-w-0">
          {p.complete ? (
            <>
              <p className="font-display text-[17px] font-bold tracking-tight text-ink">
                All six done.
              </p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-subtle">
                The roadmap below is the order to use everything else in.
              </p>
            </>
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                Next · day {p.next?.day}
              </p>
              <p className="mt-0.5 font-display text-[17px] font-bold tracking-tight text-ink">
                {p.next?.title}
              </p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-subtle">{p.next?.target}</p>
            </>
          )}
        </div>
      </div>

      <ol className="mt-6">
        {p.steps.map((s, i) => {
          const isOpen = open === s.key;
          const isNext = p.next?.key === s.key;
          const last = i === p.steps.length - 1;
          const isChannel = s.key === "telegram";
          return (
            <li key={s.key} className="flex gap-4">
              {/* The climb: a rail of markers, filled as far as you've got. */}
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold transition-colors ${
                    s.done
                      ? "bg-orange text-white"
                      : isNext
                        ? "border-2 border-orange bg-card text-accent-ink"
                        : "border border-line-strong bg-card text-faint"
                  }`}
                >
                  {s.done ? <CheckIcon width={16} height={16} strokeWidth={2.6} /> : s.day}
                </span>
                {!last && (
                  <span className={`mt-1 w-0.5 flex-1 ${s.done ? "bg-orange/35" : "bg-line"}`} />
                )}
              </div>

              <div className={`min-w-0 flex-1 ${last ? "" : "pb-3"}`}>
                <div
                  className={`overflow-hidden rounded-2xl border bg-card shadow-soft transition-colors ${
                    isNext && !s.done ? "border-orange/40" : "border-line"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : s.key)}
                    aria-expanded={isOpen}
                    aria-controls={`step-${s.key}`}
                    className="flex w-full cursor-pointer items-center gap-3 p-4 text-left transition-colors hover:bg-accent-soft/40 sm:p-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                          Day {s.day} · {s.stage}
                        </span>
                        {s.done ? (
                          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-ink">
                            {isChannel ? "Opened" : "Done"}
                          </span>
                        ) : (
                          isNext && (
                            <span className="rounded-full bg-orange px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              You&apos;re here
                            </span>
                          )
                        )}
                      </span>
                      <span
                        className={`mt-1 block font-display text-[16px] font-bold tracking-tight ${
                          s.done ? "text-subtle" : "text-ink"
                        }`}
                      >
                        {s.title}
                      </span>
                    </span>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                      className={`shrink-0 text-faint transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    >
                      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`step-${s.key}`}
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-line px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
                          <p className="text-[13.5px] leading-relaxed text-subtle">
                            {s.key === "desk" ? deskPitchFor(archetype) : s.blurb}
                          </p>

                          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                            <div className="rounded-xl border border-line bg-paper p-3.5">
                              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-faint">
                                What this gets you
                              </p>
                              <p className="mt-1 text-[13px] leading-relaxed text-ink">{s.goal}</p>
                            </div>
                            <div className="rounded-xl border border-orange/25 bg-accent-soft/50 p-3.5">
                              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-accent-ink">
                                Your target
                              </p>
                              <p className="mt-1 text-[13px] leading-relaxed text-ink">{s.target}</p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            {isChannel ? (
                              <a
                                href={s.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={openChannel}
                                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
                              >
                                <TelegramIcon width={16} height={16} />
                                {s.done ? "Open the channel again" : "Open the channel"}
                              </a>
                            ) : (
                              <Link
                                href={s.href}
                                className={
                                  s.done
                                    ? "inline-flex items-center gap-2 rounded-xl border border-line-strong bg-card px-4 py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:border-orange/40 hover:text-accent-ink"
                                    : "inline-flex items-center gap-2 rounded-xl bg-orange px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
                                }
                              >
                                {s.done ? "Open again" : isNext ? "Start this step" : "Open"}
                              </Link>
                            )}
                            {isChannel && (
                              <span className="inline-flex items-center gap-1.5 text-[12px] text-faint">
                                <ExternalIcon width={13} height={13} />
                                Opens Telegram — tap Join there to finish it
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
