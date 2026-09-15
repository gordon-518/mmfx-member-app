// Shapes fn_admin_measurement()'s JSON for /stats (conversion-fix Phase 7).
// Pure and defensive: a missing, errored or malformed payload renders as
// empty views rather than breaking the dashboard.

export interface TierCohort {
  tier: "foundation" | "desk" | "team";
  members: number;
  /** Members whose first deposit is 90+ days old: only they count in the averages. */
  mature: number;
  avgCum90: number | null;
  medianCum90: number | null;
}

export interface Split {
  viewers: number;
  viewersConverted: number;
  viewersPct: number;
  others: number;
  othersConverted: number;
  othersPct: number;
}

export interface TrialCohort {
  era: "7-day" | "14-day";
  signups: number;
  /** Signups 30+ days old: the only ones the 30-day rate uses. */
  mature: number;
  converted30: number;
  /** converted30 / mature; null until the cohort has any mature signups. */
  rate30Pct: number | null;
  convertedSoFar: number;
}

export interface Week {
  week: string;
  signups: number;
  tvPct: number;
  activatedPct: number;
}

export interface Measurement {
  tiers: TierCohort[];
  split: Split;
  trials: TrialCohort[];
  weekly: Week[];
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function maybe(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;
}
function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x) => x && typeof x === "object") as Record<string, unknown>[] : [];
}

const TIERS = ["foundation", "desk", "team"] as const;

export function shapeMeasurement(raw: unknown): Measurement {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const byTier = new Map(arr(r.tier_cohorts).map((t) => [String(t.entry_tier), t]));
  const tiers: TierCohort[] = TIERS.map((tier) => {
    const t = byTier.get(tier) ?? {};
    return {
      tier,
      members: num(t.members),
      mature: num(t.mature),
      avgCum90: maybe(t.avg_cum90),
      medianCum90: maybe(t.median_cum90),
    };
  });

  const s = r.analysis_split && typeof r.analysis_split === "object" ? (r.analysis_split as Record<string, unknown>) : {};
  const split: Split = {
    viewers: num(s.viewers),
    viewersConverted: num(s.viewers_converted),
    viewersPct: pct(num(s.viewers_converted), num(s.viewers)),
    others: num(s.others),
    othersConverted: num(s.others_converted),
    othersPct: pct(num(s.others_converted), num(s.others)),
  };

  const byEra = new Map(arr(r.trial_cohorts).map((t) => [String(t.era), t]));
  const trials: TrialCohort[] = (["7-day", "14-day"] as const).map((era) => {
    const t = byEra.get(era) ?? {};
    const mature = num(t.mature);
    const converted30 = num(t.converted30);
    return {
      era,
      signups: num(t.signups),
      mature,
      converted30,
      rate30Pct: mature > 0 ? pct(converted30, mature) : null,
      convertedSoFar: num(t.converted_so_far),
    };
  });

  const weekly: Week[] = arr(r.weekly).map((w) => {
    const signups = num(w.signups);
    return {
      week: String(w.week ?? ""),
      signups,
      tvPct: pct(num(w.tv48), signups),
      activatedPct: pct(num(w.activated), signups),
    };
  });

  return { tiers, split, trials, weekly };
}
