// The sponsorship windows (design 2026-11-05 §2): which countries a sponsor
// paid for and from when. They drive the page header and the default range.

import type { FunnelClient } from "@/lib/partners/funnel";

export interface SponsorWindow {
  country: string;
  /** ISO timestamp. */
  since: string;
  /** ISO timestamp, or null for an open-ended deal. */
  until: string | null;
}

export function shapeWindow(raw: Record<string, unknown>): SponsorWindow | null {
  if (typeof raw.country !== "string" || typeof raw.since !== "string") return null;
  return { country: raw.country, since: raw.since, until: typeof raw.until === "string" ? raw.until : null };
}

export async function fetchWindows(db: FunnelClient, slug: string): Promise<SponsorWindow[]> {
  try {
    const { data, error } = await db.rpc("fn_sponsor_windows", { p_slug: slug });
    if (error) {
      console.error("[sponsors] windows failed:", error.message);
      return [];
    }
    return Array.isArray(data)
      ? data.map((r) => shapeWindow(r as Record<string, unknown>)).filter((w): w is SponsorWindow => w !== null)
      : [];
  } catch (e) {
    console.error("[sponsors] windows threw:", e);
    return [];
  }
}

/** The earliest window start, or null when no window is on file yet. */
export function dealStart(windows: SponsorWindow[]): Date | null {
  const times = windows.map((w) => new Date(w.since).getTime()).filter((t) => Number.isFinite(t));
  return times.length ? new Date(Math.min(...times)) : null;
}

const REGION = new Intl.DisplayNames(["en"], { type: "region" });

/** ISO-2 → English name. ICU answers "Unknown Region" for codes it has no
 *  name for (ZZ is literally that), so the code itself is shown instead. */
export function countryName(code: string): string {
  try {
    const name = REGION.of(code);
    return !name || /^unknown region$/i.test(name) ? code : name;
  } catch {
    return code;
  }
}

/** `2026-11-01T…` → `1 Nov 2026`. UTC: the dates come from the database. */
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "Malaysia from 1 Nov 2026" · "Singapore 1 Nov 2026 to 31 Jan 2027". */
export function describeWindow(w: SponsorWindow): string {
  const name = countryName(w.country);
  return w.until ? `${name} ${fmtDate(w.since)} to ${fmtDate(w.until)}` : `${name} from ${fmtDate(w.since)}`;
}
