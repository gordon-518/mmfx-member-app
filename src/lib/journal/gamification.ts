import type { JournalTradeRow, JournalGoalsRow, JournalRulesConfig } from "./types";
import type { JournalAnalytics } from "./analytics";
import { dayKey } from "./analytics";
import { evaluateRules } from "./rules";
import { isoWeek } from "./interventions";

// Pure discipline-state engine for the dashboard hero + mission card. The
// 30-day score and the current-week clean/trading day counts are derived from
// verified trade history (reusing evaluateRules for clean-day logic), so they
// are tamper-proof and recomputable. `now` is passed in (deterministic).
//
// (An earlier version also produced streak/XP/level for a gamified UI that was
// removed pre-launch; those fields were dropped with it — see git history if
// that direction is revived.)

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
  cleanDaysThisWeek: number;
  tradingDaysThisWeek: number;
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

  // Clean-day map over full history (reuse the rules breach logic), reduced to
  // the current ISO week for the mission card.
  const full = evaluateRules(closed, rulesConfig, goals, startBal);
  // dayKey on both so the clean-day set lines up with the rules' breach days
  // (both use the SGT-offset calendar day). b.when is either a dayKey string
  // (daily rules) or an ISO time (trade rules); dayKey handles both.
  const breachedDays = new Set(full.breaches.map((b) => dayKey(b.when)));
  const tradingDays = [
    ...new Set(closed.map((t) => dayKey(t.close_time as string))),
  ];
  const wk = isoWeek(now);
  const weekDays = tradingDays.filter((d) => isoWeek(`${d}T00:00:00.000Z`) === wk);
  const tradingDaysThisWeek = weekDays.length;
  const cleanDaysThisWeek = weekDays.filter(
    (d) => rulesSet && !breachedDays.has(d)
  ).length;

  return { score, rulesSet, cleanDaysThisWeek, tradingDaysThisWeek };
}
