# AI Trading Journal — Gamified Redesign

**Date:** 2026-07-28
**Status:** Approved design — pending plan
**Related:** [[2026-07-24-survival-engine-leak-health]] (L1), [[2026-07-24-survival-engine-discipline-rules]] (L2), [[2026-07-27-survival-engine-interventions]] (L3), journal core.

## Context

The journal is functionally complete (Phases 1–3 + Survival Engine L1–L3) but the
`/journal` UI is a flat wall of equal-weight cards — no hierarchy, no emotional
arc, no reason to come back daily. This is a **full UI/UX redesign** to make the
journal a product traders *love to open*, in service of the moat (retention +
trading volume). Direction chosen by Gordon: **motivating & game-like, pushed
toward achievements** — Whoop/Strava-premium energy with an earned-progression
layer, but **adult and premium**, never juvenile. No named skill-tiers (they can
drop and demoralize); only earned progress that climbs.

Everything the journal already does is **preserved** — rules editor, goals, AI
coach, account connect/sync/disconnect, trade notes — restyled and reorganized,
not removed.

## Design principles

- **One glance answers "how am I doing?"** — a hero band leads; detail recedes.
- **Game mechanics map to verified data only** — score, streak, XP, level,
  achievements are all *deterministically derived from tamper-proof trade
  history*. No editable points; recomputable at any time; monotonic where it
  represents lifetime progress (XP/levels only ever climb).
- **Warm-premium language, kept** — the existing tokens (`--color-orange`
  #ff5a1f, warm paper `--color-paper` #fbfaf8, warm ink, `shadow-soft`, the
  `rise` load motion, `font-display`) are the foundation. Light-only.
- **Delight is earned, not constant** — celebration fires on real wins
  (level-up, badge, streak milestone, leak beaten), not on every load.
- **Motion with restraint** — count-up on the ring/XP bar, bars fill on load,
  celebration toast; all gated behind `prefers-reduced-motion`.

## The game model (all derived from verified history)

Two distinct numbers, deliberately separated:

- **Discipline score (0–100)** — *current form*. Already computed by
  `evaluateRules` (% clean trading days, 30-day window). Can rise and fall. Shown
  as the hero ring. **No tier label.**
- **Level + XP** — *lifetime earned progress*, only ever climbs. XP is a
  deterministic sum over verified lifetime facts, so it never decreases and needs
  no event log:

  | XP source | value (tunable) | derivation |
  |---|---|---|
  | Journaled trade (note or emotion logged) | +5 each | count over history |
  | Clean trading day (rules set, 0 breaches) | +10 each | discipline engine, lifetime |
  | Longest-streak milestone reached (7/14/30/60/100) | +50/+100/+250/+500/+1000 | max streak ever |
  | Achievement earned | its own XP value | achievement predicate |
  | Weekly mission completed (Phase B) | +200 each | game-state log |

  `levelForXp(xp)` uses a rising triangular curve (each level costs more);
  `xpForLevel(l)` gives the next threshold for the progress bar.

- **Streak** — current consecutive **clean trading days** ending at the most
  recent trading day. A clean day = a UTC day with ≥1 closed trade and zero
  discipline-rule breaches. Requires rules to be set; with no rules, streak = 0
  and the hero nudges "set your rules to start your streak" (on-purpose: drives
  rule-setting, the core retention behavior). Can reset — that's the tension.

- **Achievements** (Phase B) — a static catalog (~16–24), each with a pure
  `earned(context) → boolean` (monotonic: "ever" predicates so XP never drops), an
  XP value, an icon, and a short label + criterion. Starter catalog (tunable):
  First Steps (journal 1st trade), Scribe (journal 50 trades), Week Warrior (7-day
  streak), Iron Week (a 5/5 clean week), 30-Day Machine (30-day streak), Plan
  Keeper (20 lifetime clean days), Leak Slayer (a top-leak beaten), Risk Manager (a
  month with no oversized-loss leak), Marksman (a week ≥60% win rate), Disciplined
  (score ≥ 85), Comeback (recovered at_risk→healthy), Mission Master (4 missions
  completed). Locked ones show greyed with their criterion (a goal to chase).

- **Celebration** — on load, compare current game state to the user's last
  **acknowledged** state; any genuinely new gain (level-up, newly-earned badge,
  new streak milestone, leak beaten) produces a celebration toast, then the
  acknowledged state is updated. First-ever load initializes the baseline
  silently (no retroactive celebration).

## Page structure (top → bottom)

1. **Greeting + sync freshness** — "Good morning, {name}", last-synced, trade count.
2. **Hero band** — Discipline ring (score, count-up) · streak flame chip ·
   Survival shield (health status + runway) · 2–3 vitals (win rate, month P&L).
   Absorbs today's `SurvivalPanel` health summary + the discipline score.
3. **Level + XP bar** — level, progress to next, the next-reward nudge.
4. **This week's mission** — the `weekly_focus` intervention as a quest: headline,
   the $ at stake, a progress bar (clean days this week), XP reward, CTA.
5. **Leaks to beat** — leaks as "bosses": icon, name, $ bleed, total recoverable;
   expandable to the exact trades (preserves today's drill-down). Absorbs the
   leak list from `SurvivalPanel`.
6. **Achievements** (Phase B) — earned/locked trophy shelf, "N of M earned".
7. **Performance** — equity curve + drawdown charts, then a **3–4 elevated hero
   KPIs** with the remaining stats in a compact, quieter grid (today's flat
   12-tile grid is de-emphasized, not deleted).
8. **Breakdowns + history** — by symbol/session/weekday + the full trade table,
   restyled to match; trade-notes editor preserved.
9. **Rules · Goals · Coach · Accounts** — preserved and restyled, tucked below the
   hero. The rules editor (today in `DisciplinePanel`) moves into a `RulesCard`;
   goals, the AI coach card, and account connect/sync/disconnect all carry over.
10. **Intervention banner** — the critical/weekly banner stays pinned at the very
    top when active (from L3). **Celebration toast** overlays on unlock.

## Architecture

- **`src/lib/journal/gamification.ts`** (pure, TDD) — the game engine:
  - `computeGameState(input) → GameState` where input is the already-computed
    `analytics`, `rules` (RulesResult), `leaks`, `health`, and the windowed
    trades. `GameState = { score, streak, longestStreak, xp, level, xpIntoLevel,
    xpForNextLevel, achievements: Achievement[] }`.
  - `currentStreak(trades, rules)` / `cleanDays(...)` helpers (reuse the discipline
    engine's per-day breach logic — factor the shared "clean day" computation so
    `rules.ts` and `gamification.ts` agree).
  - `ACHIEVEMENTS` catalog + `earnedAchievements(context)` (Phase B).
  - `diffForCelebration(current, ack) → Celebration[]` (Phase B).
  - Pure/deterministic (`now` passed in; no `Date.now()`), no server imports.
- **`journal_game_state`** table (Phase B) — `user_id` PK → auth.users,
  `ack jsonb` (last-acknowledged {xp, level, streakMilestone, badges[],
  missionsCompleted}), `updated_at`. Own-row RLS mirroring `journal_goals`.
  Applied via the `scripts/apply-*` pattern.
- **`POST /api/journal/game/ack`** (Phase B) — persists the acknowledged state
  after a celebration is shown (`requireAdminApi` during rollout, own-row).
- **UI decomposition** — `JournalDashboard` is split into focused components
  (each its own file, following the existing `SurvivalPanel`/`DisciplinePanel`
  pattern): `JournalHero`, `LevelBar`, `MissionCard`, `LeaksToBeat`,
  `Achievements`, `PerformanceSection`, `RulesCard`, `CelebrationToast`. The
  page (`page.tsx`) computes `gameState` server-side (deterministic `now`) and
  passes it down. Existing `charts.tsx`, `InterventionBanner`, coach card, goals
  card, and account cards are reused/restyled.
- **Admin-only** stays in force (page redirect + `requireAdminApi`), same staged
  rollout as the rest.

## Motion & celebration

- Ring and XP bar **count up / fill** on load (JS, ~600ms, eased), matching the
  existing `rise` timing. Streak flame has a subtle idle pulse.
- **Celebration toast**: a dark card with confetti flecks + the win + XP gained,
  auto-dismiss + manual close. CSS-driven; fully suppressed under
  `prefers-reduced-motion` (state still updates, just no animation/confetti).

## Phasing (ships value incrementally)

- **Phase A — Visual redesign + reorg + core game numbers.** The new page shell:
  greeting, hero band (ring + streak + survival + vitals), level/XP bar, mission,
  leaks-to-beat, restyled performance/breakdowns/history, motion. `gamification.ts`
  with score/streak/XP/level (no achievements catalog, no celebration, no new
  table). Uses only already-computed data + the streak helper. **Fully shippable.**
- **Phase B — Progression + celebration.** Achievements catalog + shelf, the
  `journal_game_state` table + ack route, `diffForCelebration`, the celebration
  toast, and weekly-mission completion tracking (grants mission XP).

## Testing

- `gamification.test.ts`: streak (consecutive clean days, resets on a breach day,
  0 without rules), XP sum across sources, `levelForXp`/`xpForLevel` monotonicity
  and boundaries, and (Phase B) each achievement predicate + `diffForCelebration`
  (new badge/level/streak surfaces; nothing surfaces when ack == current; first
  load baselines silently).
- Visual/behaviour: existing journal tests keep passing; the rules editor, goals
  save, coach generate, notes save, and sync/disconnect flows still work after the
  component split (no functional regression).

## Non-goals

- Leaderboards / social / competitions (that's the Arena, direction B — separate).
- Dark mode (app is light-only).
- Editable or purchasable XP; any non-derived points.
- Real-time updates (data is once-daily sync; state refreshes on load/sync).

## Open items / future

- XP values, level curve, streak milestones, and the achievement thresholds are
  **tunable constants** — set sensible defaults, refine on real engagement data.
- Rollout: when the journal opens to clients, the game layer ships with it; the
  celebration ack + achievements are per-user already.
- Possible later: a shareable achievement/track-record card (feeds the Arena),
  discipline-score-over-time chart, sound on celebration (off by default).
