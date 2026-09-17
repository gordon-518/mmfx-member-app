import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseStore, type ChatRow, type EventRow } from "./store";

// A minimal stand-in for supabase-js's PostgrestFilterBuilder: every chain
// method (`select`, `eq`, `in`, `not`, `gte`, `order`, `limit`, `upsert`,
// `insert`, `update`, `maybeSingle`) returns the SAME chain object, and the
// chain itself is thenable — awaiting it at ANY point resolves to one fixed
// `result`. This mirrors the real client closely enough for supabaseStore's
// purposes: the query only actually runs once, whenever the caller awaits
// it, regardless of which chain method that await follows.
const CHAIN_METHODS = ["select", "eq", "in", "not", "gte", "order", "limit", "upsert", "insert", "update", "maybeSingle"] as const;

function fakeChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const m of CHAIN_METHODS) chain[m] = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

function fakeDb(result: unknown) {
  const chain = fakeChain(result);
  const from = vi.fn(() => chain);
  return { db: { from } as unknown as SupabaseClient, from, chain };
}

describe("supabaseStore", () => {
  describe("log", () => {
    it("maps a 23505 (unique violation) error to {status: 'duplicate'}", async () => {
      const { db } = fakeDb({ error: { code: "23505", message: "duplicate key value" } });
      const store = supabaseStore(db);
      await expect(store.log({ contact_id: "c1", kind: "reply", dedupe_key: "outcome:c1:m1" })).resolves.toEqual({ status: "duplicate" });
    });

    it("throws on any other insert error, rather than resolving false", async () => {
      const { db } = fakeDb({ error: { code: "500", message: "connection reset" } });
      const store = supabaseStore(db);
      await expect(store.log({ contact_id: "c1", kind: "reply" })).rejects.toThrow(/connection reset/);
    });

    it("resolves {status: 'ok'} and inserts the event on success", async () => {
      const { db, from, chain } = fakeDb({ error: null });
      const store = supabaseStore(db);
      const ev: EventRow = { contact_id: "c1", kind: "reply", reply_text: "hi" };
      await expect(store.log(ev)).resolves.toEqual({ status: "ok" });
      expect(from).toHaveBeenCalledWith("support_events");
      expect(chain.insert).toHaveBeenCalledWith(ev);
    });
  });

  describe("getChat", () => {
    it("throws on a read error rather than returning null (must fail closed, not open)", async () => {
      const { db } = fakeDb({ data: null, error: { message: "pooler timeout" } });
      const store = supabaseStore(db);
      await expect(store.getChat("c1")).rejects.toThrow(/pooler timeout/);
    });

    it("returns the row on success", async () => {
      const row: ChatRow = { contact_id: "c1", state: "needs_amelia" };
      const { db, from } = fakeDb({ data: row, error: null });
      const store = supabaseStore(db);
      await expect(store.getChat("c1")).resolves.toEqual(row);
      expect(from).toHaveBeenCalledWith("support_chats");
    });

    it("returns null when there is no row and no error", async () => {
      const { db } = fakeDb({ data: null, error: null });
      const store = supabaseStore(db);
      await expect(store.getChat("c1")).resolves.toBeNull();
    });
  });

  describe("getSettings", () => {
    it("throws on a read error rather than returning null", async () => {
      const { db } = fakeDb({ data: null, error: { message: "pooler timeout" } });
      const store = supabaseStore(db);
      await expect(store.getSettings()).rejects.toThrow(/pooler timeout/);
    });

    it("returns the row on success", async () => {
      const { db, from } = fakeDb({ data: { enabled: true }, error: null });
      const store = supabaseStore(db);
      await expect(store.getSettings()).resolves.toEqual({ enabled: true });
      expect(from).toHaveBeenCalledWith("support_settings");
    });
  });

  describe("saveChat (item 2)", () => {
    it("resolves normally on a successful upsert", async () => {
      const { db, from, chain } = fakeDb({ error: null });
      const store = supabaseStore(db);
      await expect(store.saveChat({ contact_id: "c1", state: "needs_amelia" })).resolves.toBeUndefined();
      expect(from).toHaveBeenCalledWith("support_chats");
      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ contact_id: "c1", state: "needs_amelia" }),
        { onConflict: "contact_id" }
      );
    });

    it("throws when the upsert fails, instead of swallowing the error", async () => {
      const { db } = fakeDb({ error: { message: "connection reset" } });
      const store = supabaseStore(db);
      await expect(store.saveChat({ contact_id: "c1", state: "needs_amelia" })).rejects.toThrow(/connection reset/);
    });
  });

  describe("markDelivered", () => {
    it("targets the row by dedupe_key and sets delivered_at", async () => {
      const { db, from, chain } = fakeDb({ error: null });
      const store = supabaseStore(db);
      await store.markDelivered("outcome:c1:m1");
      expect(from).toHaveBeenCalledWith("support_events");
      expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ delivered_at: expect.any(String) }));
      expect(chain.eq).toHaveBeenCalledWith("dedupe_key", "outcome:c1:m1");
    });

    it("never throws, even when the update fails (best-effort)", async () => {
      const { db } = fakeDb({ error: { message: "boom" } });
      const store = supabaseStore(db);
      await expect(store.markDelivered("outcome:c1:m1")).resolves.toBeUndefined();
    });
  });

  describe("patchSkipReason", () => {
    it("targets the row by dedupe_key and overwrites skip_reason", async () => {
      const { db, from, chain } = fakeDb({ error: null });
      const store = supabaseStore(db);
      await store.patchSkipReason("outcome:c1:m1", "reply cap reached (write failed: ping)");
      expect(from).toHaveBeenCalledWith("support_events");
      expect(chain.update).toHaveBeenCalledWith({ skip_reason: "reply cap reached (write failed: ping)" });
      expect(chain.eq).toHaveBeenCalledWith("dedupe_key", "outcome:c1:m1");
    });
  });

  describe("recentAgentTexts", () => {
    it("filters out rows with no reply_text", async () => {
      const { db } = fakeDb({ data: [{ reply_text: "hi" }, { reply_text: null }] });
      const store = supabaseStore(db);
      await expect(store.recentAgentTexts("c1", "2026-01-01T00:00:00Z")).resolves.toEqual(["hi"]);
    });

    it("returns an empty array when there is no data", async () => {
      const { db } = fakeDb({ data: null });
      const store = supabaseStore(db);
      await expect(store.recentAgentTexts("c1", "2026-01-01T00:00:00Z")).resolves.toEqual([]);
    });
  });

  describe("countRepliesSince / countModelCallsSince", () => {
    it("returns the count on success", async () => {
      const { db } = fakeDb({ count: 3, error: null });
      const store = supabaseStore(db);
      await expect(store.countRepliesSince("c1", "2026-01-01T00:00:00Z")).resolves.toBe(3);
    });

    it("returns 0 when count is null", async () => {
      const { db } = fakeDb({ count: null, error: null });
      const store = supabaseStore(db);
      await expect(store.countModelCallsSince("2026-01-01T00:00:00Z")).resolves.toBe(0);
    });
  });
});
