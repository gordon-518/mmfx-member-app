import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { refFromTexts, findMember } from "./member";

describe("refFromTexts", () => {
  it("finds the reference code, case-insensitively", () => {
    expect(refFromTexts(["hi", "Hi Amelia, I'm submitting my deposit on the MMFX app. My reference is MM-3f9a2c."])).toBe("3F9A2C");
    expect(refFromTexts(["no code here", "MM-12345"])).toBeNull();
  });

  it("resolves the same code repeated across different messages", () => {
    // A member re-pasting/confirming the same code — not ambiguous.
    expect(refFromTexts(["My reference is MM-3f9a2c", "yes, MM-3F9A2C, that's the one"])).toBe("3F9A2C");
  });

  it("refuses two distinct codes in the thread as ambiguous", () => {
    // Behaviour change: this used to return the LAST match ("AAAAAA"),
    // treating it as a typo correction. But a typo correction and a
    // forwarded/pasted second code look identical from here, and the risk
    // of attaching the chat to the wrong member outweighs the convenience —
    // so two distinct codes now means "say nothing" rather than "trust the
    // latest one".
    expect(refFromTexts(["MM-111111", "actually MM-AAAAAA"])).toBeNull();
  });
});

// --- A small typed fake for the two chain shapes `findMember` actually uses:
//   .from(t).select(c).ilike(col, pattern)                         -> terminal
//   .from(t).select(c).eq(col, v)[.order(...).order(...).limit(n)].maybeSingle() -> terminal
// `select`/`eq`/`order`/`limit` just return the same builder; `ilike` and
// `maybeSingle` resolve to `{ data, error }` so failure paths can be tested.
// No `any` — cast once at the boundary.

interface IlikeCall { column: string; pattern: string }
interface FakeError { message: string }

interface FakeBuilder {
  select(columns: string): FakeBuilder;
  eq(column: string, value: string): FakeBuilder;
  order(column: string, opts?: { ascending: boolean }): FakeBuilder;
  limit(n: number): FakeBuilder;
  ilike(column: string, pattern: string): Promise<{ data: unknown; error: FakeError | null }>;
  maybeSingle(): Promise<{ data: unknown; error: FakeError | null }>;
}

interface FakeDbConfig {
  rpcResult?: string | null;
  rpcError?: FakeError | null;
  handleRows?: { user_id: string }[];
  handleError?: FakeError | null;
  profile?: Record<string, unknown> | null;
  profileError?: FakeError | null;
  submission?: Record<string, unknown> | null;
  submissionError?: FakeError | null;
}

function makeBuilder(table: string, config: FakeDbConfig, ilikeCalls: IlikeCall[]): FakeBuilder {
  const builder: FakeBuilder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    ilike: (column, pattern) => {
      ilikeCalls.push({ column, pattern });
      return Promise.resolve({ data: config.handleRows ?? [], error: config.handleError ?? null });
    },
    maybeSingle: () => {
      if (table === "profiles") {
        return Promise.resolve({ data: config.profile ?? null, error: config.profileError ?? null });
      }
      return Promise.resolve({ data: config.submission ?? null, error: config.submissionError ?? null });
    },
  };
  return builder;
}

function makeFakeDb(config: FakeDbConfig, ilikeCalls: IlikeCall[] = []): SupabaseClient {
  const fake = {
    rpc: () => Promise.resolve({ data: config.rpcResult ?? null, error: config.rpcError ?? null }),
    from: (table: string) => makeBuilder(table, config, ilikeCalls),
  };
  return fake as unknown as SupabaseClient;
}

const profile = { account_status: "member_active", trial_ends_at: null, deposit_amount: 250, grandfathered: false, lifetime_plan: null };

describe("findMember", () => {
  it("matches by reference code when the handle doesn't resolve", async () => {
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
      attested: false,
    });
  });

  it("falls back to an exact single Telegram-handle match when there is no ref", async () => {
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
      attested: true,
    });
  });

  it("refuses when the ref and the platform-attested handle resolve to different members", async () => {
    // CRITICAL case: a pasted/forwarded reference code must not silently
    // override the handle SendPulse attests for this conversation.
    const db = makeFakeDb({
      rpcResult: "u1",
      handleRows: [{ user_id: "u2" }],
      profile,
    });
    const result = await findMember(db, { texts: ["My reference is MM-abcdef"], telegramUsername: "someone" });
    expect(result).toBeNull();
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

  it("escapes ilike wildcards so an underscore, percent or asterisk can't widen the match", async () => {
    const underscoreCalls: IlikeCall[] = [];
    const dbUnderscore = makeFakeDb({ handleRows: [{ user_id: "u4" }], profile }, underscoreCalls);
    await findMember(dbUnderscore, { texts: [], telegramUsername: "Sam_T" });
    expect(underscoreCalls).toEqual([{ column: "telegram_username", pattern: "Sam\\_T" }]);

    const percentCalls: IlikeCall[] = [];
    const dbPercent = makeFakeDb({ handleRows: [{ user_id: "u4" }], profile }, percentCalls);
    await findMember(dbPercent, { texts: [], telegramUsername: "Sam%T" });
    expect(percentCalls).toEqual([{ column: "telegram_username", pattern: "Sam\\%T" }]);

    // PostgREST translates `*` to `%` in like/ilike values, and the handle
    // is unvalidated external input from the SendPulse API.
    const starCalls: IlikeCall[] = [];
    const dbStar = makeFakeDb({ handleRows: [{ user_id: "u4" }], profile }, starCalls);
    await findMember(dbStar, { texts: [], telegramUsername: "Sam*T" });
    expect(starCalls).toEqual([{ column: "telegram_username", pattern: "Sam\\*T" }]);
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

  it("rejects rather than swallowing a failing ref lookup", async () => {
    const db = makeFakeDb({ rpcError: { message: "boom" } });
    await expect(findMember(db, { texts: ["MM-abcdef"], telegramUsername: null })).rejects.toThrow();
  });

  it("rejects rather than swallowing a failing profile read", async () => {
    const db = makeFakeDb({ rpcResult: "u1", profileError: { message: "boom" } });
    await expect(findMember(db, { texts: ["MM-abcdef"], telegramUsername: null })).rejects.toThrow();
  });

  it("rejects rather than swallowing a failing handle lookup", async () => {
    const db = makeFakeDb({ rpcResult: null, handleError: { message: "boom" } });
    await expect(findMember(db, { texts: [], telegramUsername: "someone" })).rejects.toThrow();
  });

  it("rejects rather than swallowing a failing submission read", async () => {
    const db = makeFakeDb({ rpcResult: "u1", profile, submissionError: { message: "boom" } });
    await expect(findMember(db, { texts: ["MM-abcdef"], telegramUsername: null })).rejects.toThrow();
  });

  describe("attested flag", () => {
    it("is true when matched by handle only", async () => {
      const db = makeFakeDb({ rpcResult: null, handleRows: [{ user_id: "u2" }], profile });
      const result = await findMember(db, { texts: ["no code here"], telegramUsername: "handle_guy" });
      expect(result?.matchedBy).toBe("handle");
      expect(result?.attested).toBe(true);
    });

    it("is true when the ref and the handle agree (matchedBy becomes 'handle', the stronger signal)", async () => {
      const db = makeFakeDb({ rpcResult: "u1", handleRows: [{ user_id: "u1" }], profile });
      const result = await findMember(db, { texts: ["My reference is MM-abcdef"], telegramUsername: "someone" });
      expect(result?.matchedBy).toBe("handle");
      expect(result?.attested).toBe(true);
    });

    it("is false when matched by reference code alone (no handle resolves)", async () => {
      const db = makeFakeDb({ rpcResult: "u1", profile });
      const result = await findMember(db, { texts: ["My reference is MM-abcdef"], telegramUsername: null });
      expect(result?.matchedBy).toBe("ref");
      expect(result?.attested).toBe(false);
    });
  });

  describe("edge-case handles", () => {
    it("falls back to a resolvable handle when the thread has two distinct (ambiguous) ref codes", async () => {
      const db = makeFakeDb({ handleRows: [{ user_id: "u9" }], profile });
      const result = await findMember(db, { texts: ["MM-111111", "actually MM-AAAAAA"], telegramUsername: "someone" });
      expect(result?.userId).toBe("u9");
      expect(result?.matchedBy).toBe("handle");
      expect(result?.attested).toBe(true);
    });

    it("does not match anyone on a whitespace-only handle", async () => {
      const calls: IlikeCall[] = [];
      const db = makeFakeDb({ handleRows: [] }, calls);
      const result = await findMember(db, { texts: [], telegramUsername: "   " });
      expect(calls).toEqual([{ column: "telegram_username", pattern: "   " }]);
      expect(result).toBeNull();
    });

    it("does not match anyone on a pure-wildcard handle ('___')", async () => {
      const calls: IlikeCall[] = [];
      const db = makeFakeDb({ handleRows: [] }, calls);
      const result = await findMember(db, { texts: [], telegramUsername: "___" });
      expect(calls).toEqual([{ column: "telegram_username", pattern: "\\_\\_\\_" }]);
      expect(result).toBeNull();
    });
  });
});
