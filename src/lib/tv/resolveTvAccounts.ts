// Collapse profile rows onto the TradingView ACCOUNTS they actually control.
//
// Why this exists: access on TradingView is a property of a TV handle, not of a
// profile row, and TV handles are CASE-INSENSITIVE (/u/Novamase/ 301-redirects
// to /u/novamase/). A member who signed up, let the trial lapse, then re-signed
// up under a second email leaves two profiles carrying the same handle — one
// active, one expired. The nightly cron acted on both rows independently, so a
// single run granted the handle (active row) and revoked the same handle
// (expired row). With per-script pacing and batched concurrency the two passes
// interleave, and the last writer wins PER SCRIPT — leaving a torn state like
// "10 of 12 revoked" and, because TradingView deletes alerts on a script the
// moment access is removed, killing the member's alerts every night.
// That is the Novamase (no access at all) and SNIPEFXX (alerts keep dying)
// bug, 2026-08. Six live members were affected.
//
// So: decide ONE action per TV account. An active row always beats an inactive
// one — we would rather leave access on a lapsed duplicate than strip a paying
// member. Never revoke a handle that any active profile still claims.

import type { AccountStatus } from "@/lib/trial/status";
import { accessTierFor, tierFor, type TierSnapshot } from "@/lib/tiers";
import { canAccess } from "@/lib/access/features";

export type TvProfileRow = {
  tradingview_username: string | null;
  account_status: AccountStatus;
  trial_ends_at: string | null;
  deposit_amount?: number | string | null;
  grandfathered?: boolean | null;
  lifetime_plan?: string | null;
};

export type TvAccountAction = {
  /** Handle to send to TradingView (the winning row's stored casing). */
  tvUsername: string;
  action: "grant" | "revoke";
  /** null = permanent grant; a date = trial grant TV auto-expires. */
  trialEndsAt: string | null;
};

/**
 * Whether a profile is entitled to the TradingView scripts, and until when.
 * The indicators and strategies are a Desk feature (moved from Foundation,
 * Gordon, 15 Sep), so this follows the tier ladder rather than account status:
 *   * earned Desk or above (incl. grandfathered / lifetime) -> permanent grant
 *   * Desk-level only through a running trial (a trial, or an early depositor
 *     still on their clock)                                   -> grant expiring
 *     at trial_ends_at, which TradingView enforces itself
 *   * anything else (Free, Foundation)                        -> no access
 * tvTier.test.ts pins this to the feature map.
 */
export function tvEntitlement(
  row: TvProfileRow,
  now: Date = new Date()
): { grant: boolean; expiresAt: string | null } {
  const snap: TierSnapshot = {
    account_status: row.account_status,
    trial_ends_at: row.trial_ends_at,
    deposit_amount: row.deposit_amount ?? null,
    grandfathered: row.grandfathered ?? false,
    lifetime_plan: row.lifetime_plan ?? null,
  };
  const earned = tierFor(snap, now);
  if (earned !== "trial" && canAccess("indicators", { tier: earned, isAdmin: false })) {
    return { grant: true, expiresAt: null };
  }
  if (canAccess("indicators", { tier: accessTierFor(snap, now), isAdmin: false })) {
    return { grant: true, expiresAt: row.trial_ends_at };
  }
  return { grant: false, expiresAt: null };
}

// Higher wins. A permanent grant outranks a timed (trial) one, which outranks
// no entitlement — so the strongest entitlement on a handle is the one we act on.
function rank(row: TvProfileRow, now: Date): number {
  const e = tvEntitlement(row, now);
  if (!e.grant) return 1;
  return e.expiresAt == null ? 3 : 2;
}

// Between two trials on the same handle, the one that runs longest wins;
// otherwise TV would expire access while the member is still entitled.
function endsAtMs(row: TvProfileRow): number {
  const t = row.trial_ends_at ? Date.parse(row.trial_ends_at) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

function beats(candidate: TvProfileRow, incumbent: TvProfileRow, now: Date): boolean {
  const [a, b] = [rank(candidate, now), rank(incumbent, now)];
  if (a !== b) return a > b;
  return endsAtMs(candidate) > endsAtMs(incumbent);
}

/**
 * One action per TradingView account, keyed by the lowercased handle.
 * Rows with a blank/missing handle are dropped.
 */
export function resolveTvAccounts(rows: TvProfileRow[], now: Date = new Date()): TvAccountAction[] {
  const winners = new Map<string, TvProfileRow>();

  for (const row of rows) {
    const handle = row.tradingview_username?.trim();
    if (!handle) continue;
    const key = handle.toLowerCase();
    const incumbent = winners.get(key);
    if (!incumbent || beats(row, incumbent, now)) winners.set(key, row);
  }

  return [...winners.values()].map((row) => {
    const tvUsername = row.tradingview_username!.trim();
    const e = tvEntitlement(row, now);
    if (!e.grant) {
      return { tvUsername, action: "revoke" as const, trialEndsAt: null };
    }
    // Permanent for earned Desk+; a running trial carries the expiry TV enforces.
    return { tvUsername, action: "grant" as const, trialEndsAt: e.expiresAt };
  });
}
