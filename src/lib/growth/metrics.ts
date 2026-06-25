// Growth-stats metrics — pure, side-effect-free, unit-testable. Mirrors the
// style of src/lib/trial/status.ts. The daily-stats cron feeds it the minimal
// set of profile columns and stores the result in growth_daily; the dashboard
// reuses it to live-compute "current" totals.
//
// All "today" math is anchored to Singapore time (UTC+8) so a count lines up
// with the 09:00-SGT snapshot, not the server's UTC midnight.

import type { AccountStatus } from "@/lib/trial/status";

export const BROKERS = ["octa", "dupoin", "elev8"] as const;
export type Broker = (typeof BROKERS)[number];

const MS_PER_DAY = 86_400_000;
const SGT_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8, no DST.

const ACTIVE_TRIAL: ReadonlySet<AccountStatus> = new Set([
  "trial_active",
  "re_trial_active",
]);

/** The minimal profile shape the metrics need. */
export interface GrowthProfileRow {
  signup_at: string | null;
  account_status: AccountStatus;
  trial_ends_at: string | null;
  deposit_verified_at: string | null;
  downgraded_at: string | null;
  broker: string | null;
  tradingview_username: string | null;
}

export interface GrowthMetrics {
  /** SGT calendar date of the snapshot, YYYY-MM-DD. */
  date: string;
  signups_today: number;
  signups_7d: number;
  signups_30d: number;
  trials_active: number;
  trials_expiring_48h: number;
  conversions_today: number;
  members_active: number;
  churn_today: number;
  /** % of active members with a tradingview_username set, 1 d.p. */
  tv_engagement_pct: number;
  broker_split: Record<Broker, number>;
}

/** Parse a timestamp to epoch ms; null/invalid -> NaN. */
function ms(ts: string | null): number {
  if (ts == null) return NaN;
  return new Date(ts).getTime();
}

/** SGT calendar date (YYYY-MM-DD) for the instant `now`. */
export function sgtDateString(now: Date): string {
  return new Date(now.getTime() + SGT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Epoch ms of SGT-midnight for the SGT day containing `now`. */
function sgtDayStartMs(now: Date): number {
  const shifted = new Date(now.getTime() + SGT_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  return Date.UTC(y, m, d) - SGT_OFFSET_MS;
}

/** Percentage change current-vs-prior, rounded; null when prior is 0. */
export function deltaPct(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return Math.round(((current - prior) / prior) * 100);
}

export function computeMetrics(
  rows: GrowthProfileRow[],
  now: Date = new Date()
): GrowthMetrics {
  const nowMs = now.getTime();
  const dayStart = sgtDayStartMs(now);
  const dayEnd = dayStart + MS_PER_DAY;
  const sevenDaysAgo = nowMs - 7 * MS_PER_DAY;
  const thirtyDaysAgo = nowMs - 30 * MS_PER_DAY;
  const in48h = nowMs + 2 * MS_PER_DAY;

  const inToday = (t: number) => t >= dayStart && t < dayEnd;

  let signups_today = 0;
  let signups_7d = 0;
  let signups_30d = 0;
  let trials_active = 0;
  let trials_expiring_48h = 0;
  let conversions_today = 0;
  let members_active = 0;
  let churn_today = 0;
  let membersWithTv = 0;
  const broker_split: Record<Broker, number> = { octa: 0, dupoin: 0, elev8: 0 };

  for (const r of rows) {
    const signup = ms(r.signup_at);
    if (!Number.isNaN(signup)) {
      if (inToday(signup)) signups_today++;
      if (signup >= sevenDaysAgo) signups_7d++;
      if (signup >= thirtyDaysAgo) signups_30d++;
    }

    if (ACTIVE_TRIAL.has(r.account_status)) {
      trials_active++;
      const end = ms(r.trial_ends_at);
      // Still active (not yet past) and falling due within the next 48h.
      if (!Number.isNaN(end) && end >= nowMs && end <= in48h) {
        trials_expiring_48h++;
      }
    }

    const verified = ms(r.deposit_verified_at);
    if (!Number.isNaN(verified) && inToday(verified)) conversions_today++;

    const downgraded = ms(r.downgraded_at);
    if (!Number.isNaN(downgraded) && inToday(downgraded)) churn_today++;

    if (r.account_status === "member_active") {
      members_active++;
      if (r.tradingview_username) membersWithTv++;
      const b = r.broker;
      if (b === "octa" || b === "dupoin" || b === "elev8") broker_split[b]++;
    }
  }

  const tv_engagement_pct =
    members_active === 0
      ? 0
      : Math.round((membersWithTv / members_active) * 1000) / 10;

  return {
    date: sgtDateString(now),
    signups_today,
    signups_7d,
    signups_30d,
    trials_active,
    trials_expiring_48h,
    conversions_today,
    members_active,
    churn_today,
    tv_engagement_pct,
    broker_split,
  };
}
