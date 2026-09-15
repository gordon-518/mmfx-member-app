import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { resolveTvAccounts, type TvProfileRow } from "./resolveTvAccounts";

// The fixtures use fixed Sept 2026 trial dates; pin "now" before them so a
// trial counts as live, as it did when these cases were written.
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-20T00:00:00Z"));
});
afterAll(() => vi.useRealTimers());

const row = (o: Partial<TvProfileRow>): TvProfileRow => ({
  tradingview_username: "someone",
  account_status: "member_active",
  trial_ends_at: null,
  // A Team-level member by default: the scripts are a Desk feature now.
  deposit_amount: 500,
  ...o,
});

describe("resolveTvAccounts", () => {
  it("acts once per TV account, not once per profile row", () => {
    const out = resolveTvAccounts([
      row({ tradingview_username: "Novamase", account_status: "member_active" }),
      row({ tradingview_username: "novamase", account_status: "re_trial_expired" }),
    ]);
    expect(out).toHaveLength(1);
  });

  it("lets an active member beat a lapsed duplicate — the Novamase bug", () => {
    // Before the fix this pair produced grant AND revoke on the same TV
    // account; the revoke landed last and stripped a paying member.
    const out = resolveTvAccounts([
      row({ tradingview_username: "Novamase", account_status: "member_active" }),
      row({ tradingview_username: "novamase", account_status: "re_trial_expired" }),
    ]);
    expect(out[0]).toEqual({ tvUsername: "Novamase", action: "grant", trialEndsAt: null });
  });

  it("wins regardless of row order (the expired row may be scanned first)", () => {
    const out = resolveTvAccounts([
      row({ tradingview_username: "SNIPEFXX", account_status: "trial_expired" }),
      row({ tradingview_username: "SNIPEFXX", account_status: "member_active" }),
    ]);
    expect(out).toEqual([{ tvUsername: "SNIPEFXX", action: "grant", trialEndsAt: null }]);
  });

  it("still revokes a handle no active profile claims", () => {
    const out = resolveTvAccounts([
      row({ tradingview_username: "retamitiku531", account_status: "trial_expired" }),
      row({ tradingview_username: "retamitiku531", account_status: "trial_expired" }),
    ]);
    expect(out).toEqual([{ tvUsername: "retamitiku531", action: "revoke", trialEndsAt: null }]);
  });

  it("keeps a trial's expiry so TradingView still auto-expires it", () => {
    const out = resolveTvAccounts([
      row({ tradingview_username: "omanbilal", account_status: "trial_active", trial_ends_at: "2026-09-04" }),
      row({ tradingview_username: "omanbilal", account_status: "trial_expired" }),
    ]);
    expect(out).toEqual([{ tvUsername: "omanbilal", action: "grant", trialEndsAt: "2026-09-04" }]);
  });

  it("prefers a permanent member over a live trial on the same handle", () => {
    const out = resolveTvAccounts([
      row({ tradingview_username: "dup", account_status: "trial_active", trial_ends_at: "2026-09-04" }),
      row({ tradingview_username: "dup", account_status: "member_active" }),
    ]);
    expect(out[0].trialEndsAt).toBeNull();
  });

  it("between two live trials, the longest-running one wins", () => {
    const out = resolveTvAccounts([
      row({ tradingview_username: "dup", account_status: "trial_active", trial_ends_at: "2026-09-01" }),
      row({ tradingview_username: "dup", account_status: "re_trial_active", trial_ends_at: "2026-09-30" }),
    ]);
    expect(out[0].trialEndsAt).toBe("2026-09-30");
  });

  it("drops blank and missing handles", () => {
    expect(
      resolveTvAccounts([
        row({ tradingview_username: null }),
        row({ tradingview_username: "   " }),
      ])
    ).toEqual([]);
  });

  it("trims stored whitespace before sending the handle to TradingView", () => {
    const out = resolveTvAccounts([row({ tradingview_username: "  Trader1  " })]);
    expect(out[0].tvUsername).toBe("Trader1");
  });

  it("leaves unrelated accounts untouched", () => {
    const out = resolveTvAccounts([
      row({ tradingview_username: "a", account_status: "member_active" }),
      row({ tradingview_username: "b", account_status: "trial_expired" }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.find((x) => x.tvUsername === "b")?.action).toBe("revoke");
  });
});

describe("resolveTvAccounts — the scripts are a Desk feature (15 Sep)", () => {
  it("a Foundation member ($60) gets no TradingView access", () => {
    expect(resolveTvAccounts([row({ tradingview_username: "f", deposit_amount: 60 })])).toEqual([
      { tvUsername: "f", action: "revoke", trialEndsAt: null },
    ]);
  });
  it("an early depositor on a running trial gets access until the trial ends", () => {
    expect(resolveTvAccounts([row({ tradingview_username: "e", deposit_amount: 60, trial_ends_at: "2026-09-04" })])).toEqual([
      { tvUsername: "e", action: "grant", trialEndsAt: "2026-09-04" },
    ]);
  });
  it("grandfathered and lifetime members are permanent", () => {
    const out = resolveTvAccounts([
      row({ tradingview_username: "g", deposit_amount: null, grandfathered: true }),
      row({ tradingview_username: "l", deposit_amount: null, lifetime_plan: "team" }),
    ]);
    expect(out.every((o) => o.action === "grant" && o.trialEndsAt === null)).toBe(true);
  });
});
