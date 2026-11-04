"use client";

import Link from "next/link";
import { onboardingProgress, deskPitchFor, type OnboardingState } from "@/lib/onboarding";
import { useT } from "@/i18n/client";
import { fmt } from "@/i18n/format";

// The dashboard's onboarding card (conversion-fix 4.2): the next open step,
// shown until every step is done. Presentational only — progress comes from
// fn_my_onboarding() via the page. The full roadmap this links to lives at
// /welcome (src/app/welcome/StartHere.tsx), which is interactive and so has
// its own client component; this stays a plain card.

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full bg-orange transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function OnboardingChecklist({
  state,
  archetype,
}: {
  state: OnboardingState;
  archetype?: string | null;
}) {
  const t = useT();
  const p = onboardingProgress(state);
  if (p.complete || !p.next) return null;
  const next = p.next;
  const copy = t.onboarding.steps[next.key];

  return (
    <section className="rounded-2xl border border-orange/25 bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
          {fmt(t.onboarding.card.gettingStarted, { done: p.doneCount, total: p.total })}
        </p>
        <Link href="/welcome" className="text-[12.5px] font-semibold text-subtle transition-colors hover:text-ink">
          {fmt(t.onboarding.card.allSteps, { n: p.total })}
        </Link>
      </div>
      <div className="mt-2.5">
        <Bar pct={p.pct} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
            {fmt(t.onboarding.card.dayStage, { day: next.day, stage: t.onboarding.stages[next.stageKey] })}
          </p>
          <p className="mt-0.5 font-display text-[17px] font-bold tracking-tight text-ink">{copy.title}</p>
          <p className="mt-0.5 text-[13px] text-subtle">
            {next.key === "desk" ? deskPitchFor(t, archetype) : copy.blurb}
          </p>
        </div>
        {/* Straight to the step — except the channel, whose click has to be
            recorded on /welcome or the step could never tick over. */}
        <Link
          href={next.external ? "/welcome" : next.href}
          className="shrink-0 rounded-xl bg-orange px-4 py-2 text-[13px] font-semibold text-white shadow-soft transition-colors hover:bg-[#f24e12]"
        >
          {t.onboarding.card.start}
        </Link>
      </div>
    </section>
  );
}
