import type { JournalTradeRow, JournalGoalsRow, JournalRulesConfig } from "./types";
import type { JournalAnalytics } from "./analytics";
import { evaluateRules } from "./rules";
import { isoWeek } from "./interventions";

// Pure game-state engine. Score, streak, XP and level are all derived from
// verified trade history (reusing evaluateRules for clean-day logic), so they
// are tamper-proof and recomputable. `now` is passed in (deterministic).

const CLEAN_DAY_XP = 10;
const JOURNALED_TRADE_XP = 5;
const STREAK_MILESTONES: [number, number][] = [
  [7, 50],
  [14, 100],
  [30, 250],
  [60, 500],
  [100, 1000],
];

export interface GameInput {
  analytics: JournalAnalytics;
  rulesConfig: JournalRulesConfig;
  goals: JournalGoalsRow | null;
  trades: JournalTradeRow[];
  now: string;
}

export interface GameState {
  score: number | null; // 30d discipline score (current form)
  rulesSet: boolean;
  streak: number; // current consecutive clean trading days
  longestStreak: number;
  cleanDaysThisWeek: number;
  tradingDaysThisWeek: number;
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

export function xpToReachLevel(level: number): number {
  return 50 * (level - 1) * level; // L1=0, L2=100, L3=300, L4=600, L5=1000 …
}
export function levelForXp(xp: number): number {
  let l = 1;
  while (xpToReachLevel(l + 1) <= xp) l += 1;
  return l;
}

function runsFrom(cleanByDay: [string, boolean][]): { current: number; longest: number } {
  // cleanByDay sorted ascending by day. current = trailing run of clean days.
  let longest = 0;
  let run = 0;
  let current = 0;
  for (let i = 0; i < cleanByDay.length; i++) {
    if (cleanByDay[i][1]) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
    current = run; // after the loop this holds the trailing run
  }
  return { current, longest };
}

export function computeGameState(inp: GameInput): GameState {
  const { trades, rulesConfig, goals, analytics, now } = inp;
  const startBal = analytics.startingBalance;

  const rulesSet = Object.values(rulesConfig).some(
    (r) => r && typeof r === "object" && (r as { enabled?: boolean }).enabled
  );

  const closed = trades
    .filter((t) => t.status === "closed" && t.close_time)
    .sort((a, b) => (a.close_time as string).localeCompare(b.close_time as string));

  // 30-day score (current form).
  const thirtyAgo = new Date(new Date(now).getTime() - 30 * 86_400_000).toISOString();
  const score = evaluateRules(
    closed.filter((t) => (t.close_time as string) >= thirtyAgo),
    rulesConfig,
    goals,
    startBal
  ).score;

  // Clean-day map over full history (reuse the rules breach logic).
  const full = evaluateRules(closed, rulesConfig, goals, startBal);
  const breachedDays = new Set(full.breaches.map((b) => b.when.slice(0, 10)));
  const tradingDays = [
    ...new Set(closed.map((t) => (t.close_time as string).slice(0, 10))),
  ].sort();
  const cleanByDay: [string, boolean][] = tradingDays.map((d) => [
    d,
    rulesSet && !breachedDays.has(d),
  ]);

  const { current, longest } = runsFrom(cleanByDay);
  const streak = rulesSet ? current : 0;
  const longestStreak = rulesSet ? longest : 0;

  // This ISO week.
  const wk = isoWeek(now);
  const weekDays = cleanByDay.filter(([d]) => isoWeek(`${d}T00:00:00.000Z`) === wk);
  const tradingDaysThisWeek = weekDays.length;
  const cleanDaysThisWeek = weekDays.filter(([, clean]) => clean).length;

  // XP.
  const journaled = closed.filter((t) => t.note || t.emotion).length;
  const cleanTotal = cleanByDay.filter(([, clean]) => clean).length;
  let xp = journaled * JOURNALED_TRADE_XP + cleanTotal * CLEAN_DAY_XP;
  for (const [threshold, value] of STREAK_MILESTONES) {
    if (longestStreak >= threshold) xp += value;
  }

  const level = levelForXp(xp);
  const xpIntoLevel = xp - xpToReachLevel(level);
  const xpForNextLevel = xpToReachLevel(level + 1) - xpToReachLevel(level);

  return {
    score,
    rulesSet,
    streak,
    longestStreak,
    cleanDaysThisWeek,
    tradingDaysThisWeek,
    xp,
    level,
    xpIntoLevel,
    xpForNextLevel,
  };
}
