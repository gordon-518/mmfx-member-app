// Decide what to do for a PERMANENT (member) grant on a single script, given
// the user's current grant state on TradingView.
//
// Why this exists: the nightly tv-sync cron re-grants every member. The old
// permanent path blindly did remove-then-add on all 12 scripts every night —
// so any night the paired add failed (a rate-limit burst, a 403, a blip) left
// the member with that script REMOVED until a future run happened to succeed.
// That is the "the MM Structure Map has been removed" bug (Fernando, 2026-08)
// and the source of the recurring "1/12 failed" alerts.
//
// The remove is only ever needed to clear a *stale trial expiration* on a
// trial→member conversion (the AkaniR case) — a one-time event, never nightly.
// So we act idempotently and, critically, ONLY remove when we have positively
// confirmed a real expiration exists. Uncertain input (a failed lookup = null)
// falls back to a plain add, which never strips an existing grant.

export type TvGrant = { granted: boolean; expiration: string | null };
export type GrantPlan = "skip" | "add" | "reset";

/**
 * @param grant current grant state, or null if the lookup failed/was skipped.
 * @returns
 *   "skip"  — already granted with no expiration; leave it alone (no removal window)
 *   "reset" — granted but still carries a (trial) expiration; remove then add to clear it
 *   "add"   — not granted, or state unknown; plain add (idempotent, never removes)
 */
export function planPermanentGrant(grant: TvGrant | null): GrantPlan {
  if (!grant || !grant.granted) return "add";
  return grant.expiration ? "reset" : "skip";
}
