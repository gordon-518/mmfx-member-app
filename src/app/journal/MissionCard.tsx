"use client";

import type { Intervention } from "@/lib/journal/interventions";
import type { GameState } from "@/lib/journal/gamification";

// The app content scrolls inside AppShell's own container, so a plain #rules
// anchor doesn't move it — scroll the rules card into view programmatically.
function scrollToRules() {
  document.getElementById("rules")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// The weekly-focus intervention, reframed as a quest with weekly progress.
export function MissionCard({
  interventions,
  game,
}: {
  interventions: Intervention[];
  game: GameState;
}) {
  const mission = interventions.find((i) => i.kind === "weekly_focus");
  if (!mission) return null;
  const total = game.tradingDaysThisWeek || 5;
  const done = Math.min(game.cleanDaysThisWeek, total);
  const width = total ? Math.round((done / total) * 100) : 0;
  return (
    <section className="rise rounded-3xl bg-ink p-6 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-[280px] flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-orange">
            This week&apos;s mission
          </p>
          <h3 className="mt-1.5 font-display text-lg font-bold text-white">
            {mission.headline.replace("This week's focus: ", "")}
          </h3>
          <p className="mt-1 text-[13px] text-white/70">{mission.body}</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-orange" style={{ width: `${width}%` }} />
            </div>
            <span className="whitespace-nowrap text-[12px] font-bold text-white">
              {done} / {total} clean days
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={scrollToRules}
          className="cursor-pointer whitespace-nowrap rounded-xl bg-orange px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#f24e12]"
        >
          View plan
        </button>
      </div>
    </section>
  );
}
