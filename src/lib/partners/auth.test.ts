import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { hashKey, keyMatches, PARTNER_SLUG, resolvePartner, type PartnerRow } from "./auth";

const KEY = "a".repeat(64);
const HASH = createHash("sha256").update(KEY).digest("hex");

function db(row: PartnerRow | null, throws = false) {
  const maybeSingle = vi.fn(async () => {
    if (throws) throw new Error("connection reset");
    return { data: row, error: null };
  });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from }, from, select, eq };
}

const REN: PartnerRow = { slug: "ren", name: "Ren", key_hash: HASH, active: true };

describe("hashKey", () => {
  it("is the sha256 hex the migration stores", () => {
    expect(hashKey(KEY)).toBe(HASH);
    expect(hashKey(KEY)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("keyMatches", () => {
  it("accepts the right key", () => {
    expect(keyMatches(KEY, HASH)).toBe(true);
  });

  it("rejects a wrong key, including one off by a single character", () => {
    expect(keyMatches("b".repeat(64), HASH)).toBe(false);
    expect(keyMatches("a".repeat(63) + "b", HASH)).toBe(false);
  });

  it("rejects an empty or missing key rather than matching an empty hash", () => {
    expect(keyMatches("", HASH)).toBe(false);
    expect(keyMatches(null, HASH)).toBe(false);
    expect(keyMatches(undefined, HASH)).toBe(false);
    expect(keyMatches(KEY, null)).toBe(false);
    expect(keyMatches(KEY, "")).toBe(false);
  });

  it("does not throw on a malformed stored hash — it just does not match", () => {
    // timingSafeEqual throws on a length mismatch; comparing digests is what
    // keeps that impossible, and a junk hash must fail closed either way.
    expect(keyMatches(KEY, "not-hex")).toBe(false);
    expect(keyMatches(KEY, "abcd")).toBe(false);
    expect(keyMatches(KEY, HASH + "00")).toBe(false);
  });
});

describe("PARTNER_SLUG", () => {
  it("takes a hyphen-free slug of 2 to 24 characters", () => {
    expect(PARTNER_SLUG.test("ren")).toBe(true);
    expect(PARTNER_SLUG.test("agency01")).toBe(true);
  });

  it("refuses hyphens, capitals and anything path-shaped", () => {
    for (const s of ["re-n", "Ren", "r", "a".repeat(25), "../etc", "ren%20"]) {
      expect(PARTNER_SLUG.test(s), s).toBe(false);
    }
  });
});

describe("resolvePartner", () => {
  it("returns the partner for a right key", async () => {
    const { client } = db(REN);
    await expect(resolvePartner(client, "ren", KEY)).resolves.toEqual({ slug: "ren", name: "Ren" });
  });

  it("looks the partner up by slug and asks for no secret it does not need", async () => {
    const { client, from, select, eq } = db(REN);
    await resolvePartner(client, "ren", KEY);
    expect(from).toHaveBeenCalledWith("partners");
    expect(select).toHaveBeenCalledWith("slug, name, key_hash, active");
    expect(eq).toHaveBeenCalledWith("slug", "ren");
  });

  it("returns null for a wrong key", async () => {
    const { client } = db(REN);
    await expect(resolvePartner(client, "ren", "b".repeat(64))).resolves.toBeNull();
  });

  it("returns null for a missing key", async () => {
    const { client } = db(REN);
    await expect(resolvePartner(client, "ren", null)).resolves.toBeNull();
  });

  it("returns null for a deactivated partner even with the right key", async () => {
    const { client } = db({ ...REN, active: false });
    await expect(resolvePartner(client, "ren", KEY)).resolves.toBeNull();
  });

  it("returns null for an unknown slug — and never queries a malformed one", async () => {
    const unknown = db(null);
    await expect(resolvePartner(unknown.client, "ren", KEY)).resolves.toBeNull();

    const bad = db(REN);
    await expect(resolvePartner(bad.client, "../admin", KEY)).resolves.toBeNull();
    expect(bad.from).not.toHaveBeenCalled();
  });

  it("fails closed when the database is unreachable", async () => {
    const { client } = db(REN, true);
    await expect(resolvePartner(client, "ren", KEY)).resolves.toBeNull();
  });
});
