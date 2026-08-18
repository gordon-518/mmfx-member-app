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

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** SGT wall-clock parts (year, 0-based month, day-of-month, weekday 0=Sun) for an instant. */
function sgtParts(atMs: number): { y: number; m: number; d: number; dow: number } {
  const s = new Date(atMs + SGT_OFFSET_MS);
  return {
    y: s.getUTCFullYear(),
    m: s.getUTCMonth(),
    d: s.getUTCDate(),
    dow: s.getUTCDay(),
  };
}

/** Epoch ms of SGT-midnight for the SGT day containing `atMs`. */
function sgtDayStartFromMs(atMs: number): number {
  const { y, m, d } = sgtParts(atMs);
  return Date.UTC(y, m, d) - SGT_OFFSET_MS;
}

/** Epoch ms of SGT-midnight for the SGT day containing `now`. */
function sgtDayStartMs(now: Date): number {
  return sgtDayStartFromMs(now.getTime());
}

/** Epoch ms of SGT-midnight of the Monday that opens the week containing `atMs`. */
function sgtWeekStartMs(atMs: number): number {
  const dayStart = sgtDayStartFromMs(atMs);
  const fromMonday = (sgtParts(atMs).dow + 6) % 7; // Mon=0 … Sun=6
  return dayStart - fromMonday * MS_PER_DAY;
}

/** Representative epoch ms (SGT midnight) for a "YYYY-MM-DD" SGT date string. */
function sgtDateToMs(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - SGT_OFFSET_MS;
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

// ---------------------------------------------------------------------------
// Period bucketing for the dashboard's Daily/Weekly/Monthly/Yearly toggle.
//
// Two metric families are handled differently:
//   * Flow metrics (signups, conversions, churn) are re-derivable from the raw
//     profile timestamps for the FULL history, so `bucketFlowMetrics` computes
//     them live with no snapshots and no backfill.
//   * Point-in-time metrics (active trials/members …) cannot be reconstructed
//     historically, so `bucketSnapshotSeries` folds the forward-only
//     growth_daily snapshots into the same buckets (last snapshot per bucket).
//
// All bucket boundaries are SGT-anchored (UTC+8, no DST), consistent with the
// rest of this module. Windows: daily = last 30 days, weekly = last 12 Mon–Sun
// weeks, monthly = last 12 SGT calendar months, yearly = every SGT calendar
// year back to the earliest data.
// ---------------------------------------------------------------------------

export const GROWTH_PERIODS = ["daily", "weekly", "monthly", "yearly"] as const;
export type GrowthPeriod = (typeof GROWTH_PERIODS)[number];

/** One bucket of live-derived flow counts. */
export interface FlowBucket {
  /** Stable identifier (e.g. "2026-06-25", "2026-06", "2026"). */
  key: string;
  /** Short human label (e.g. "25 Jun", "Jun 2026", "2026"). */
  label: string;
  signups: number;
  conversions: number;
  churn: number;
}

interface Bucket {
  key: string;
  label: string;
  startMs: number;
  endMs: number;
}

/** A single point-in-time snapshot value keyed by its SGT date. */
export interface SnapshotDatum {
  date: string; // "YYYY-MM-DD" (SGT calendar date)
  value: number;
}

/** Coerce a raw ?period= query value to a valid period (defaults to daily). */
export function parsePeriod(value: string | string[] | undefined): GrowthPeriod {
  const s = Array.isArray(value) ? value[0] : value;
  return (GROWTH_PERIODS as readonly string[]).includes(s ?? "")
    ? (s as GrowthPeriod)
    : "daily";
}

function dayLabel(atMs: number): string {
  const { d, m } = sgtParts(atMs);
  return `${d} ${MONTH_ABBR[m]}`;
}

/**
 * Ordered (oldest → newest) list of SGT-anchored buckets covering the period's
 * window. `rows` is only consulted for the yearly window, to find the earliest
 * year present in the data.
 */
function periodBuckets(
  period: GrowthPeriod,
  now: Date,
  rows: GrowthProfileRow[]
): Bucket[] {
  const nowMs = now.getTime();
  const out: Bucket[] = [];

  switch (period) {
    case "daily": {
      const todayStart = sgtDayStartFromMs(nowMs);
      for (let i = 29; i >= 0; i--) {
        const start = todayStart - i * MS_PER_DAY;
        out.push({
          key: sgtDateString(new Date(start)),
          label: dayLabel(start),
          startMs: start,
          endMs: start + MS_PER_DAY,
        });
      }
      return out;
    }
    case "weekly": {
      const WEEK = 7 * MS_PER_DAY;
      const thisWeek = sgtWeekStartMs(nowMs);
      for (let i = 11; i >= 0; i--) {
        const start = thisWeek - i * WEEK;
        out.push({
          key: sgtDateString(new Date(start)),
          label: dayLabel(start),
          startMs: start,
          endMs: start + WEEK,
        });
      }
      return out;
    }
    case "monthly": {
      const { y, m } = sgtParts(nowMs);
      for (let i = 11; i >= 0; i--) {
        const yy = y + Math.floor((m - i) / 12);
        const mm = (((m - i) % 12) + 12) % 12;
        out.push({
          key: `${yy}-${pad2(mm + 1)}`,
          label: `${MONTH_ABBR[mm]} ${yy}`,
          startMs: Date.UTC(yy, mm, 1) - SGT_OFFSET_MS,
          endMs: Date.UTC(yy, mm + 1, 1) - SGT_OFFSET_MS, // Date.UTC handles Dec→Jan overflow
        });
      }
      return out;
    }
    case "yearly": {
      const currentYear = sgtParts(nowMs).y;
      let earliest = currentYear;
      for (const r of rows) {
        for (const ts of [r.signup_at, r.deposit_verified_at, r.downgraded_at]) {
          const t = ms(ts);
          if (!Number.isNaN(t)) {
            const yy = sgtParts(t).y;
            if (yy < earliest) earliest = yy;
          }
        }
      }
      for (let yy = earliest; yy <= currentYear; yy++) {
        out.push({
          key: `${yy}`,
          label: `${yy}`,
          startMs: Date.UTC(yy, 0, 1) - SGT_OFFSET_MS,
          endMs: Date.UTC(yy + 1, 0, 1) - SGT_OFFSET_MS,
        });
      }
      return out;
    }
  }
}

/** Index of the (contiguous, sorted) bucket containing `t`, or -1 if outside. */
function bucketIndexOf(buckets: Bucket[], t: number): number {
  if (Number.isNaN(t) || buckets.length === 0) return -1;
  if (t < buckets[0].startMs || t >= buckets[buckets.length - 1].endMs) return -1;
  for (let i = 0; i < buckets.length; i++) {
    if (t >= buckets[i].startMs && t < buckets[i].endMs) return i;
  }
  return -1;
}

/**
 * Flow metrics (signups, conversions, churn) bucketed across the period window,
 * derived live from raw profile timestamps. Returns oldest → newest, so the last
 * element is the current bucket and the series reads left-to-right.
 */
export function bucketFlowMetrics(
  rows: GrowthProfileRow[],
  period: GrowthPeriod,
  now: Date = new Date()
): FlowBucket[] {
  const buckets = periodBuckets(period, now, rows);
  const counts: FlowBucket[] = buckets.map((b) => ({
    key: b.key,
    label: b.label,
    signups: 0,
    conversions: 0,
    churn: 0,
  }));

  for (const r of rows) {
    const su = bucketIndexOf(buckets, ms(r.signup_at));
    if (su >= 0) counts[su].signups++;
    const cv = bucketIndexOf(buckets, ms(r.deposit_verified_at));
    if (cv >= 0) counts[cv].conversions++;
    const ch = bucketIndexOf(buckets, ms(r.downgraded_at));
    if (ch >= 0) counts[ch].churn++;
  }

  return counts;
}

/**
 * Point-in-time snapshot values folded into the period's buckets, taking the
 * LAST snapshot within each bucket. Buckets with no snapshot are dropped, so the
 * result is a forward-only series in chronological order (fewer than 2 values →
 * the Sparkline shows its "not enough history yet" state).
 */
export function bucketSnapshotSeries(
  points: SnapshotDatum[],
  period: GrowthPeriod,
  now: Date = new Date()
): number[] {
  const buckets = periodBuckets(period, now, []);
  const best: (SnapshotDatum | null)[] = buckets.map(() => null);

  for (const p of points) {
    const idx = bucketIndexOf(buckets, sgtDateToMs(p.date));
    if (idx < 0) continue;
    const cur = best[idx];
    // ISO date strings sort lexicographically, so a later date wins.
    if (cur == null || p.date > cur.date) best[idx] = p;
  }

  return best
    .filter((b): b is SnapshotDatum => b != null)
    .map((b) => b.value);
}
