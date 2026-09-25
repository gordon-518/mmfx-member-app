import { createHash, timingSafeEqual } from "node:crypto";

// The dashboard's whole access control (design 2026-09-25 §2.6). There is no
// login: the partner has a link with a key in it, and that key either matches
// the stored hash or the page is a 404.
//
// A bearer credential in a URL is a deliberate trade. The alternative — an
// account, a password, a reset flow — is a week of work and a support burden
// for an audience of one agency, and the page discloses nothing but counts.
// What that trade DOES require is that the key be long, random, stored only
// as a hash, rotatable in one SQL call, and compared in constant time.

/** The stored form: sha256 of the raw key, lowercase hex. */
export function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/**
 * Constant-time key check.
 *
 * Compares DIGESTS, not the keys themselves: the digests are always the same
 * length, so timingSafeEqual can never throw on a length mismatch and the
 * comparison leaks nothing about how much of the key was right. A stored hash
 * that is not 32 bytes of hex is treated as no match rather than trusted.
 */
export function keyMatches(key: string | null | undefined, keyHash: string | null | undefined): boolean {
  if (!key || !keyHash) return false;

  let stored: Buffer;
  try {
    stored = Buffer.from(keyHash.trim(), "hex");
  } catch {
    return false;
  }
  if (stored.length !== 32) return false;

  const given = Buffer.from(hashKey(key), "hex");
  return timingSafeEqual(given, stored);
}

/** Slugs are hyphen-free: AGY-<slug>-<label> has to split exactly one way,
 *  and the label half is a Meta ad name full of hyphens. */
export const PARTNER_SLUG = /^[a-z0-9]{2,24}$/;

export interface Partner {
  slug: string;
  name: string;
}

export interface PartnerRow {
  slug: string;
  name: string;
  key_hash: string;
  active: boolean;
  report_email?: string | null;
}

/** The slice of a Supabase client the lookup needs. */
export interface PartnerClient {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: string
      ): { maybeSingle(): PromiseLike<{ data: PartnerRow | null; error: unknown }> };
    };
  };
}

/**
 * Resolve a partner from the URL, or null. Null covers every failure — a bad
 * slug, no such partner, a deactivated one, a wrong key, a database error —
 * because the page's answer to all of them is the same 404. Telling the
 * difference would tell a stranger which slugs exist.
 */
export async function resolvePartner(
  db: PartnerClient,
  slug: string,
  key: string | null | undefined
): Promise<Partner | null> {
  if (!PARTNER_SLUG.test(slug)) return null;
  if (!key) return null;

  let row: PartnerRow | null = null;
  try {
    const res = await db
      .from("partners")
      .select("slug, name, key_hash, active")
      .eq("slug", slug)
      .maybeSingle();
    row = res.data;
  } catch {
    return null;
  }

  if (!row || !row.active) return null;
  if (!keyMatches(key, row.key_hash)) return null;
  return { slug: row.slug, name: row.name };
}
