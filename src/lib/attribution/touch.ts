// The attribution touch log's client side (design 2026-09-25 §2.2).
//
// profiles.attr_cid is FIRST touch and is written once, at signup. It answers
// "which ad brought this person in" and nothing else — so after signup the
// funnel went dark, and there was no way to say which ad a funded client last
// saw before they deposited. attribution_touches is that record, and this
// module is the one way into it from application code.
//
// Deliberately free of any Node-only import: src/proxy.ts runs on the Edge
// runtime and imports ATTR_CID from here. The database handle is injected, so
// nothing is constructed at module scope either.

/** Where a cid came from. Mirrors attribution_touches.source's check. */
export type TouchSource = "AGY" | "CRT" | "ORG" | "EML" | "other";

/**
 * The cids we attribute: `AGY-` ad partner, `CRT-` our own paid, `ORG-`
 * organic, `EML-` lifecycle email.
 *
 * The label half is permissive on purpose. An AGY- cid carries a Meta ad name
 * substituted from `{{ad.name}}`, written by a human in Ads Manager — spaces,
 * dots and percent-encoding are ordinary, and normalising them would stop the
 * label matching what the partner reads in their own reports. The charset is
 * the same one fn_record_touch accepts; anything outside it is not ours and is
 * dropped rather than stored.
 */
export const ATTR_CID = /^(AGY|CRT|ORG|EML)-[A-Za-z0-9._%~ -]{1,110}$/;

/**
 * The longest cid this shape can carry: a four-character prefix plus
 * ATTR_CID's 110-character label. A longer ad name is TRUNCATED to this
 * rather than dropped — a truncated label still names the ad and still
 * attributes, where a dropped cid loses the click entirely. The column and
 * fn_record_touch cap at 120, so this always fits.
 */
export const CID_MAX = 114;

export function touchSource(cid: string): TouchSource {
  const prefix = cid.slice(0, 3);
  return prefix === "AGY" || prefix === "CRT" || prefix === "ORG" || prefix === "EML"
    ? prefix
    : "other";
}

/** Trim, cap, and return null unless it is a cid we recognise. */
export function normalizeCid(raw: string | null | undefined): string | null {
  const cid = (raw ?? "").trim().slice(0, CID_MAX);
  return cid && ATTR_CID.test(cid) ? cid : null;
}

export interface TouchInput {
  userId?: string | null;
  anonId?: string | null;
  cid: string;
  geo?: string | null;
  path?: string | null;
}

/**
 * The slice of a Supabase client this needs — injected, never constructed.
 * PromiseLike, not Promise: supabase-js returns a thenable builder, and
 * narrowing to Promise would make the real client fail to type-check here.
 */
export interface TouchClient {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): PromiseLike<{ error: { message: string } | null }>;
}

/**
 * Record one touch. Best-effort by contract: a touch that cannot be written
 * must never break the signup or the page render that triggered it, so every
 * failure path returns false rather than throwing.
 *
 * Goes through fn_record_touch (security definer, service role) because
 * attribution_touches has RLS on and no policies — a session client would
 * match zero rows and, as in the 2026-09-10 attribution bug, report no error.
 */
export async function recordTouch(db: TouchClient, t: TouchInput): Promise<boolean> {
  const cid = normalizeCid(t.cid);
  if (!cid) return false;

  const userId = t.userId?.trim() || null;
  const anonId = t.anonId?.trim().slice(0, 64) || null;
  if (!userId && !anonId) return false;

  const geoRaw = (t.geo ?? "").trim().toUpperCase();
  const geo = /^[A-Z]{2}$/.test(geoRaw) ? geoRaw : null;

  try {
    const { error } = await db.rpc("fn_record_touch", {
      p_user_id: userId,
      p_cid: cid,
      p_geo: geo,
      p_path: t.path?.trim().slice(0, 200) || null,
      p_anon_id: anonId,
    });
    if (error) {
      console.error("[attribution] touch failed:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[attribution] touch threw:", e);
    return false;
  }
}
