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

export type TvProfileRow = {
  tradingview_username: string | null;
  account_status: AccountStatus;
  trial_ends_at: string | null;
};

export type TvAccountAction = {
  /** Handle to send to TradingView (the winning row's stored casing). */
  tvUsername: string;
  action: "grant" | "revoke";
  /** null = permanent grant; a date = trial grant TV auto-expires. */
  trialEndsAt: string | null;
};

const ACTIVE = new Set<AccountStatus>(["trial_active", "re_trial_active", "member_active"]);

// Higher wins. A permanent member outranks a trial, which outranks anything
// lapsed — so the strongest entitlement on a handle is the one we act on.
function rank(status: AccountStatus): number {
  if (status === "member_active") return 3;
  if (ACTIVE.has(status)) return 2;
  return 1;
}

// Between two trials on the same handle, the one that runs longest wins;
// otherwise TV would expire access while the member is still entitled.
function endsAtMs(row: TvProfileRow): number {
  const t = row.trial_ends_at ? Date.parse(row.trial_ends_at) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

function beats(candidate: TvProfileRow, incumbent: TvProfileRow): boolean {
  const [a, b] = [rank(candidate.account_status), rank(incumbent.account_status)];
  if (a !== b) return a > b;
  return endsAtMs(candidate) > endsAtMs(incumbent);
}

/**
 * One action per TradingView account, keyed by the lowercased handle.
 * Rows with a blank/missing handle are dropped.
 */
export function resolveTvAccounts(rows: TvProfileRow[]): TvAccountAction[] {
  const winners = new Map<string, TvProfileRow>();

  for (const row of rows) {
    const handle = row.tradingview_username?.trim();
    if (!handle) continue;
    const key = handle.toLowerCase();
    const incumbent = winners.get(key);
    if (!incumbent || beats(row, incumbent)) winners.set(key, row);
  }

  return [...winners.values()].map((row) => {
    const tvUsername = row.tradingview_username!.trim();
    if (!ACTIVE.has(row.account_status)) {
      return { tvUsername, action: "revoke" as const, trialEndsAt: null };
    }
    return {
      tvUsername,
      action: "grant" as const,
      // Members are permanent; trials carry the expiry TV enforces for us.
      trialEndsAt: row.account_status === "member_active" ? null : row.trial_ends_at,
    };
  });
}
