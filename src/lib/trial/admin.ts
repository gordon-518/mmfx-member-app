// Re-trial eligibility — UI convenience ONLY.
// This mirrors the rule inside fn_grant_retrial so the admin page can decide
// whether to show/enable the "Grant re-trial" button. It is NOT the gate:
// the database function enforces eligibility unconditionally, with no
// admin override, regardless of what the UI allows.

import type { AccountStatus } from "./status";

const MS_PER_DAY = 86_400_000;
const DORMANCY_DAYS = 60;
const TRIAL_CAP = 2;

export interface RetrialSnapshot {
  account_status: AccountStatus;
  downgraded_at: string | Date | null;
  trial_count: number;
}

/**
 * True iff the user could be granted the one allowed re-trial right now:
 * trial_expired AND downgraded_at set AND dormant >= 60 days AND
 * trial_count < 2. Mirrors fn_grant_retrial exactly (>= on the boundary).
 */
export function canGrantRetrial(
  profile: RetrialSnapshot,
  now: Date = new Date()
): boolean {
  if (profile.account_status !== "trial_expired") return false;
  if (profile.trial_count >= TRIAL_CAP) return false;
  if (profile.downgraded_at == null) return false;

  const downgraded = new Date(profile.downgraded_at).getTime();
  if (Number.isNaN(downgraded)) return false;

  return now.getTime() - downgraded >= DORMANCY_DAYS * MS_PER_DAY;
}
