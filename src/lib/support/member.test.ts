import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { refFromTexts, findMember } from "./member";

describe("refFromTexts", () => {
  it("finds the latest reference code, case-insensitively", () => {
    expect(refFromTexts(["hi", "Hi Amelia, I'm submitting my deposit on the MMFX app. My reference is MM-3f9a2c."])).toBe("3F9A2C");
    expect(refFromTexts(["MM-111111", "actually MM-AAAAAA"])).toBe("AAAAAA");
    expect(refFromTexts(["no code here", "MM-12345"])).toBeNull();
  });
});

// --- A small typed fake for the two chain shapes `findMember` actually uses:
//   .from(t).select(c).ilike(col, pattern)                         -> terminal
//   .from(t).select(c).eq(col, v)[.order(...).limit(n)].maybeSingle() -> terminal
// `select`/`eq`/`order`/`limit` just return the same builder; `ilike` and
// `maybeSingle` resolve. No `any` — cast once at the boundary.

interface IlikeCall { column: string; pattern: string }

interface FakeBuilder {
  select(columns: string): FakeBuilder;
  eq(column: string, value: string): FakeBuilder;
  order(column: string, opts?: { ascending: boolean }): FakeBuilder;
  limit(n: number): FakeBuilder;
  ilike(column: string, pattern: string): Promise<{ data: unknown }>;
  maybeSingle(): Promise<{ data: unknown }>;
}

interface FakeDbConfig {
  rpcResult?: string | null;
  handleRows?: { user_id: string }[];
  profile?: Record<string, unknown> | null;
  submission?: Record<string, unknown> | null;
}

function makeBuilder(table: string, config: FakeDbConfig, ilikeCalls: IlikeCall[]): FakeBuilder {
  const builder: FakeBuilder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    ilike: (column, pattern) => {
      ilikeCalls.push({ column, pattern });
      return Promise.resolve({ data: config.handleRows ?? [] });
    },
    maybeSingle: () => {
      const data = table === "profiles" ? config.profile ?? null : config.submission ?? null;
      return Promise.resolve({ data });
    },
  };
  return builder;
}

function makeFakeDb(config: FakeDbConfig, ilikeCalls: IlikeCall[] = []): SupabaseClient {
  const fake = {
    rpc: () => Promise.resolve({ data: config.rpcResult ?? null }),
    from: (table: string) => makeBuilder(table, config, ilikeCalls),
  };
  return fake as unknown as SupabaseClient;
}

const profile = { account_status: "member_active", trial_ends_at: null, deposit_amount: 250, grandfathered: false, lifetime_plan: null };

describe("findMember", () => {
  it("matches by reference code first", async () => {
    const db = makeFakeDb({
      rpcResult: "u1",
      profile,
      submission: { status: "pending", reject_reason: null, created_at: "2026-09-15T01:00:00Z" },
    });
    const result = await findMember(db, { texts: ["My reference is MM-abcdef"], telegramUsername: "someone" });
    expect(result).toEqual({
      userId: "u1",
      matchedBy: "ref",
      tier: "desk",
      trialEndsAt: null,
      submission: { status: "pending", rejectReason: null, createdAt: "2026-09-15T01:00:00Z" },
    });
  });

  it("falls back to an exact single Telegram-handle match", async () => {
    const db = makeFakeDb({
      rpcResult: null,
      handleRows: [{ user_id: "u2" }, { user_id: "u2" }],
      profile,
      submission: null,
    });
    const result = await findMember(db, { texts: ["no code here"], telegramUsername: "handle_guy" });
    expect(result).toEqual({
      userId: "u2",
      matchedBy: "handle",
      tier: "desk",
      trialEndsAt: null,
      submission: null,
    });
  });

  it("refuses an ambiguous handle", async () => {
    const db = makeFakeDb({
      rpcResult: null,
      handleRows: [{ user_id: "u2" }, { user_id: "u3" }],
      profile,
    });
    const result = await findMember(db, { texts: [], telegramUsername: "shared_handle" });
    expect(result).toBeNull();
  });

  it("returns null with neither a code nor a handle", async () => {
    const db = makeFakeDb({});
    const result = await findMember(db, { texts: [], telegramUsername: null });
    expect(result).toBeNull();
  });

  it("escapes ilike wildcards so an underscore or percent can't widen the match", async () => {
    const underscoreCalls: IlikeCall[] = [];
    const dbUnderscore = makeFakeDb({ handleRows: [{ user_id: "u4" }], profile }, underscoreCalls);
    await findMember(dbUnderscore, { texts: [], telegramUsername: "Sam_T" });
    expect(underscoreCalls).toEqual([{ column: "telegram_username", pattern: "Sam\\_T" }]);

    const percentCalls: IlikeCall[] = [];
    const dbPercent = makeFakeDb({ handleRows: [{ user_id: "u4" }], profile }, percentCalls);
    await findMember(dbPercent, { texts: [], telegramUsername: "Sam%T" });
    expect(percentCalls).toEqual([{ column: "telegram_username", pattern: "Sam\\%T" }]);
  });

  it("strips a leading @ from the handle", async () => {
    const calls: IlikeCall[] = [];
    const db = makeFakeDb({ handleRows: [{ user_id: "u5" }], profile }, calls);
    await findMember(db, { texts: [], telegramUsername: "@sam_t" });
    expect(calls).toEqual([{ column: "telegram_username", pattern: "sam\\_t" }]);
  });

  it("returns null when the profile lookup finds nothing", async () => {
    const db = makeFakeDb({ rpcResult: "u1", profile: null });
    const result = await findMember(db, { texts: ["MM-abcdef"], telegramUsername: null });
    expect(result).toBeNull();
  });
});
