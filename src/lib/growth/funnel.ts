// Shapes fn_admin_funnel_stats' JSON for /stats (conversion-fix 1.5).
//
// Pure and defensive: a missing, errored or malformed payload renders as
// zeros rather than crashing the dashboard.

export interface FunnelStep {
  key: string;
  label: string;
  users: number;
  /** % of the previous step; null for the first step. */
  pctOfPrev: number | null;
}

export interface FunnelSummary {
  days: number;
  /** Signups in the window with a full 48h behind them (legacy excluded). */
  cohort: number;
  /** TradingView connected AND Daily Analysis viewed, both within 48h. */
  activated: number;
  tv48: number;
  da48: number;
  /** activated / cohort, 1 d.p. */
  activationPct: number;
  steps: FunnelStep[];
  activatedVerified: number;
  notActivatedVerified: number;
  activatedConvPct: number;
  notActivatedConvPct: number;
}

const STEP_ORDER: readonly (readonly [string, string])[] = [
  ["upgrade_viewed", "Viewed the upgrade page"],
  ["upgrade_broker_link_clicked", "Clicked a broker link"],
  ["upgrade_contact_clicked", "Messaged us"],
  ["deposit_submitted", "Submitted a deposit"],
  ["deposit_verified", "Deposit verified"],
];

/** Non-negative integer, or 0. The DB returns counts; anything else is noise. */
function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;
}

export function summariseFunnel(raw: unknown): FunnelSummary {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const f = r.funnel && typeof r.funnel === "object" ? (r.funnel as Record<string, unknown>) : {};

  const cohort = num(r.cohort);
  const activated = num(r.activated);
  const activatedVerified = num(r.activated_verified);
  const notActivatedVerified = num(r.not_activated_verified);

  const steps: FunnelStep[] = [];
  for (const [key, label] of STEP_ORDER) {
    const users = num(f[key]);
    const prev = steps.length ? steps[steps.length - 1].users : null;
    steps.push({ key, label, users, pctOfPrev: prev == null ? null : pct(users, prev) });
  }

  return {
    days: num(r.days) || 30,
    cohort,
    activated,
    tv48: num(r.tv48),
    da48: num(r.da48),
    activationPct: pct(activated, cohort),
    steps,
    activatedVerified,
    notActivatedVerified,
    activatedConvPct: pct(activatedVerified, activated),
    notActivatedConvPct: pct(notActivatedVerified, Math.max(0, cohort - activated)),
  };
}
