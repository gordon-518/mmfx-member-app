// Trial / access derivation — pure, side-effect-free, and unit-testable.
// The access tier here MUST match the time-check guard in docs/SCHEMA.md:
// trial_active / re_trial_active count as Full access ONLY while
// now() < trial_ends_at, regardless of the stored account_status. This guards
// against a late/failed expiry write leaving an expired trial with access.

export type AccountStatus =
  | "trial_active"
  | "trial_expired"
  | "member_active"
  | "re_trial_active"
  | "re_trial_expired"
  | "member_expired";

export type AccessTier = "Full" | "Limited";

export interface TrialSnapshot {
  account_status: AccountStatus;
  /** Null for members — the clock is cleared on the flip to member_active. */
  trial_ends_at: string | Date | null;
}

const MS_PER_DAY = 86_400_000;

// States whose Full access is conditional on the trial clock.
const FULL_WHILE_ACTIVE: ReadonlySet<AccountStatus> = new Set([
  "trial_active",
  "re_trial_active",
]);

/** Whole days until trial_ends_at, rounded up, never negative. Null -> 0. */
export function daysRemaining(
  trialEndsAt: string | Date | null,
  now: Date = new Date()
): number {
  if (trialEndsAt == null) return 0;
  const end = new Date(trialEndsAt).getTime();
  if (Number.isNaN(end)) return 0;
  const diffDays = (end - now.getTime()) / MS_PER_DAY;
  return Math.max(0, Math.ceil(diffDays));
}

/**
 * Access tier derived from state WITH the time-check guard.
 * - member_active        -> always Full
 * - trial/re_trial active -> Full only while now < trial_ends_at, else Limited
 * - everything else       -> Limited
 */
export function accessTier(
  snapshot: TrialSnapshot,
  now: Date = new Date()
): AccessTier {
  if (snapshot.account_status === "member_active") return "Full";

  if (FULL_WHILE_ACTIVE.has(snapshot.account_status)) {
    // No clock on an active-trial state can never count as Full.
    if (snapshot.trial_ends_at == null) return "Limited";
    const end = new Date(snapshot.trial_ends_at).getTime();
    return !Number.isNaN(end) && now.getTime() < end ? "Full" : "Limited";
  }

  return "Limited";
}

const STATUS_LABELS: Record<AccountStatus, string> = {
  trial_active: "Trial active",
  trial_expired: "Trial expired",
  member_active: "Member",
  re_trial_active: "Re-trial active",
  re_trial_expired: "Re-trial expired",
  member_expired: "Member expired",
};

/** Human-readable label for a status; falls back to the raw value. */
export function formatStatus(status: AccountStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export interface TrialView {
  accountStatus: AccountStatus;
  statusLabel: string;
  daysRemaining: number;
  accessTier: AccessTier;
}

/** One call to derive everything the dashboard needs from a profile row. */
export function resolveTrialView(
  snapshot: TrialSnapshot,
  now: Date = new Date()
): TrialView {
  return {
    accountStatus: snapshot.account_status,
    statusLabel: formatStatus(snapshot.account_status),
    daysRemaining: daysRemaining(snapshot.trial_ends_at, now),
    accessTier: accessTier(snapshot, now),
  };
}
