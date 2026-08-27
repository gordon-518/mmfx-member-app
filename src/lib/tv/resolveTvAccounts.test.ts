import { describe, it, expect } from "vitest";
import { resolveTvAccounts, type TvProfileRow } from "./resolveTvAccounts";

const row = (o: Partial<TvProfileRow>): TvProfileRow => ({
  tradingview_username: "someone",
  account_status: "member_active",
  trial_ends_at: null,
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
