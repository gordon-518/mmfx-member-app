import Link from "next/link";
import { STAGES, FOUNDATIONS, type RailCard } from "@/app/dashboard/rails";

// The onboarding roadmap: the trader-development climb, built on the same
// STAGES/FOUNDATIONS spine as the dashboard. Static guide + promote.

const STAGE_COPY: Record<number, { title: string; tagline: string }> = {
  1: { title: "Read the market", tagline: "Learn to build the trade — the what, and the why" },
  2: { title: "Execute with confidence", tagline: "Find and place the trade — on your own" },
  3: { title: "Manage like a pro", tagline: "The highest level — protect and grow the position" },
};

function FeatureLink({ card }: { card: RailCard }) {
  const Icon = card.icon;
  return (
    <Link
      href={card.href}
      className="group flex items-center gap-3 rounded-xl border border-line bg-paper/60 p-3 transition-all hover:-translate-y-0.5 hover:border-orange/30 hover:bg-card hover:shadow-soft"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
        <Icon width={18} height={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-bold tracking-tight text-ink">{card.title}</span>
        <span className="block truncate text-[12px] text-faint">{card.blurb}</span>
      </span>
    </Link>
  );
}

export function RoadmapJourney() {
  return (
    <div>
      <div className="max-w-xl">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-orange">Your roadmap</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          The path to trading gold profitably
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-subtle">
          Three levels take you from reading the market, to executing on your own,
          to managing trades like a pro. Every tool you need is here — this is the
          order to use them in.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {STAGES.map((stage, i) => {
          const copy = STAGE_COPY[stage.n] ?? { title: stage.label, tagline: stage.tagline };
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
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {stage.cards.map((c) => (
                    <FeatureLink key={c.key} card={c} />
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
          <p className="font-display text-[17px] font-bold tracking-tight text-white">A profitable, independent trader</p>
          <p className="text-[13px] text-white/60">Where the roadmap leads.</p>
        </div>
      </div>

      {/* Foundations */}
      <div className="mt-6">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-faint">The foundation under it all</p>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
          {FOUNDATIONS.map((c) => (
            <FeatureLink key={c.key} card={c} />
          ))}
        </div>
      </div>
    </div>
  );
}
