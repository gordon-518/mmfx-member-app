import Link from "next/link";
import { STAGES, FOUNDATIONS, type RailCard } from "@/app/dashboard/rails";
import { CheckIcon } from "@/components/icons";
import { ONBOARDING_STEPS, type OnboardingState, type StageKey } from "@/lib/onboarding";
import { getT } from "@/i18n/server";
import { fmt } from "@/i18n/format";
import { railCardText } from "@/i18n/rails";
import { INVENTORY } from "@/lib/deskInventory";
import type { Messages } from "@/i18n/messages/types";

// The roadmap under the checklist: the trader-development climb, on the same
// STAGES/FOUNDATIONS spine as the dashboard. Each level now names the first
// six-step task that belongs to it and whether it's behind you, so the climb
// and the checklist are visibly the same journey rather than two lists.

/** Which onboarding stage each climb level corresponds to. */
const LEVEL_STAGE: Record<number, StageKey> = { 1: "analysis", 2: "execution", 3: "tradeManagement" };

/** The checklist step that opens a level. */
function stepForLevel(n: number) {
  return ONBOARDING_STEPS.find((s) => s.stageKey === LEVEL_STAGE[n]) ?? null;
}

const COUNTS = { indicators: INVENTORY.indicators, lessons: INVENTORY.lessons };

function FeatureLink({ card, t }: { card: RailCard; t: Messages }) {
  const Icon = card.icon;
  const text = railCardText(t, card.key, COUNTS);
  return (
    <Link
      href={card.href}
      className="group flex items-center gap-3 rounded-xl border border-line bg-paper/60 p-3 transition-all hover:-translate-y-0.5 hover:border-orange/30 hover:bg-card hover:shadow-soft"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
        <Icon width={18} height={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-bold tracking-tight text-ink">{text.title}</span>
        <span className="block truncate text-[12px] text-faint">{text.blurb}</span>
      </span>
    </Link>
  );
}

export async function RoadmapJourney({ state }: { state: OnboardingState }) {
  const t = await getT();
  const w = t.welcome;
  return (
    <div>
      <div className="max-w-xl">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-orange">{w.roadmapEyebrow}</p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {w.roadmapTitle}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-subtle">
          {w.roadmapIntro}
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {STAGES.map((stage, i) => {
          const copy = (w.levels as Record<string, { title: string; tagline: string }>)[`s${stage.n}`];
          return (
            <div key={stage.n} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange text-[16px] font-bold text-white shadow-soft">
                  {stage.n}
                </span>
                {i < STAGES.length - 1 && <span className="mt-1.5 w-0.5 flex-1 bg-line-strong/60" />}
              </div>
              <div className="flex-1 rounded-2xl border border-line bg-card p-4 shadow-soft sm:p-5">
                <h2 className="font-display text-lg font-bold tracking-tight text-ink">{copy.title}</h2>
                <p className="mt-0.5 text-[13px] font-semibold text-orange">{copy.tagline}</p>
                {(() => {
                  const step = stepForLevel(stage.n);
                  if (!step) return null;
                  const done = state[step.key] === true;
                  return (
                    <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-paper px-2.5 py-1 text-[12px] text-subtle">
                      <span
                        aria-hidden
                        className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${
                          done ? "bg-orange text-white" : "border border-line-strong text-faint"
                        }`}
                      >
                        {done ? <CheckIcon width={10} height={10} strokeWidth={3} /> : null}
                      </span>
                      {fmt(done ? w.stepDone : w.stepTodo, { day: step.day })}{" "}
                      <b className="font-semibold text-ink">{t.onboarding.steps[step.key].title}</b>
                    </p>
                  );
                })()}
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {stage.cards.map((c) => (
                    <FeatureLink key={c.key} card={c} t={t} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summit */}
      <div className="mt-5 flex items-center gap-3.5 rounded-2xl bg-ink p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-orange">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M6 4h12v3a6 6 0 0 1-12 0V4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M9 20h6M12 13v7M4 5h2v2a3 3 0 0 1-2-2.8V5Zm16 0h-2v2a3 3 0 0 0 2-2.8V5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div>
          <p className="font-display text-[17px] font-bold tracking-tight text-white">{w.summitTitle}</p>
          <p className="text-[13px] text-white/60">{w.summitBody}</p>
        </div>
      </div>

      {/* Foundations */}
      <div className="mt-6">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-faint">{w.foundationLabel}</p>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
          {FOUNDATIONS.map((c) => (
            <FeatureLink key={c.key} card={c} t={t} />
          ))}
        </div>
      </div>
    </div>
  );
}
