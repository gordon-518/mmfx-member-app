import { describe, it, expect } from "vitest";
import { stalledConnecting, type AccountJob, type ConnectingAccount } from "./stalledConnecting";

const NOW = new Date("2026-09-29T12:00:00Z");
const HOUR = 60 * 60_000;
const acct = (id: string, createdAt: string): ConnectingAccount => ({
  id,
  metaapi_account_id: `meta-${id}`,
  created_at: createdAt,
});

describe("stalledConnecting", () => {
  it("sweeps an account whose last attempt finished long ago", () => {
    const a = acct("a", "2026-09-23T09:58:00Z");
    const jobs: AccountJob[] = [{ account_id: "a", status: "failed", finished_at: "2026-09-23T10:32:00Z" }];
    expect(stalledConnecting([a], jobs, NOW, HOUR).map((x) => x.id)).toEqual(["a"]);
  });

  it("leaves an account with a job still queued or running", () => {
    const a = acct("a", "2026-09-23T09:58:00Z");
    expect(stalledConnecting([a], [{ account_id: "a", status: "queued", finished_at: null }], NOW, HOUR)).toEqual([]);
    expect(stalledConnecting([a], [{ account_id: "a", status: "running", finished_at: null }], NOW, HOUR)).toEqual([]);
  });

  it("leaves a connect that's still within the grace window", () => {
    const a = acct("a", "2026-09-29T11:40:00Z");
    const jobs: AccountJob[] = [{ account_id: "a", status: "failed", finished_at: "2026-09-29T11:50:00Z" }];
    expect(stalledConnecting([a], jobs, NOW, HOUR)).toEqual([]);
  });

  it("falls back to the connect time when no job ever finished", () => {
    const old = acct("old", "2026-09-23T09:58:00Z");
    const fresh = acct("fresh", "2026-09-29T11:45:00Z");
    expect(stalledConnecting([old, fresh], [], NOW, HOUR).map((x) => x.id)).toEqual(["old"]);
  });

  it("uses the most recent finish, not the first", () => {
    const a = acct("a", "2026-09-20T00:00:00Z");
    const jobs: AccountJob[] = [
      { account_id: "a", status: "failed", finished_at: "2026-09-23T10:32:00Z" },
      { account_id: "a", status: "done", finished_at: "2026-09-29T11:55:00Z" },
    ];
    expect(stalledConnecting([a], jobs, NOW, HOUR)).toEqual([]);
  });

  it("ignores jobs belonging to other accounts, and unparseable timestamps", () => {
    const a = acct("a", "2026-09-23T09:58:00Z");
    const jobs: AccountJob[] = [
      { account_id: "b", status: "queued", finished_at: null },
      { account_id: "a", status: "failed", finished_at: "not-a-date" },
    ];
    expect(stalledConnecting([a], jobs, NOW, HOUR).map((x) => x.id)).toEqual(["a"]);
  });

  it("returns nothing when there are no connecting accounts", () => {
    expect(stalledConnecting([], [], NOW, HOUR)).toEqual([]);
  });
});
