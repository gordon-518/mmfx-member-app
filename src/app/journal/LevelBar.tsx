"use client";

import { useCountUp } from "./useCountUp";
import type { GameState } from "@/lib/journal/gamification";

export function LevelBar({ game }: { game: GameState }) {
  const filled = useCountUp(
    game.xpForNextLevel ? game.xpIntoLevel / game.xpForNextLevel : 0,
    800
  );
  return (
    <section className="rise rounded-2xl border border-line bg-card p-4 shadow-soft">
      <div className="flex items-center gap-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink font-display text-lg font-extrabold text-orange">
          {game.level}
        </div>
        <div className="flex-1">
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] font-bold text-ink">Level {game.level}</span>
            <span className="text-[12px] text-subtle">
              {game.xpIntoLevel.toLocaleString()} / {game.xpForNextLevel.toLocaleString()} XP
            </span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-orange"
              style={{ width: `${Math.round(filled * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
