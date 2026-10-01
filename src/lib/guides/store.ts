// The table <-> contract seam.
//
// `public.guides` is snake_case because Postgres is; the guide JSON v2 contract
// is camelCase because the site reads it. Every crossing of that line goes
// through this file, so neither side has to know about the other's spelling and
// a renamed key is one edit.
//
// It is also where the "never 500 on a bad row" rule from the design doc lives.
// A row can fail validation for reasons no route can prevent — a limit tightened
// after the row was written, a hand-run SQL statement, a jsonb column edited in
// the Supabase table editor. The reader returns null for such a row and logs it;
// the slug route turns that into a 404 and the list drops it. A half-valid guide
// must never reach the renderer, and one bad row must never take out the index.

import { guideErrors, validateGuide, type GuideV2 } from "./validate";

/** The guides table, exactly as Postgres spells it. */
export interface GuideRow {
  slug: string;
  feature: string;
  title: string;
  description: string;
  published_on: string;
  cid: string;
  h2s: unknown;
  body_markdown: string;
  takeaways: unknown;
  pull_quote: string | null;
  cover: unknown;
  visuals: unknown;
  status: string;
  created_at: string;
  updated_at: string;
}

/** The columns every read selects. Named rather than `*` so a new column is a decision. */
export const GUIDE_COLUMNS =
  "slug, feature, title, description, published_on, cid, h2s, body_markdown, " +
  "takeaways, pull_quote, cover, visuals, status, created_at, updated_at";

/** Where a published guide lives. The site's own origin, not this app's. */
export const GUIDES_ORIGIN = "https://marketmakersfx.net";

/** The public URL of a guide — what POST hands back to the brain. */
export function guideUrl(slug: string): string {
  return `${GUIDES_ORIGIN}/guides/${slug}`;
}

/**
 * The row's keys in the contract's spelling, unvalidated.
 *
 * `pull_quote` is dropped rather than carried as null when it is null, because
 * the contract's `pullQuote` is optional and the validator refuses a null.
 */
function toContract(row: GuideRow): Record<string, unknown> {
  const guide: Record<string, unknown> = {
    slug: row.slug,
    title: row.title,
    description: row.description,
    feature: row.feature,
    publishedOn: row.published_on,
    cid: row.cid,
    h2s: row.h2s,
    bodyMarkdown: row.body_markdown,
    takeaways: row.takeaways,
    cover: row.cover,
    visuals: row.visuals,
  };
  if (row.pull_quote !== null && row.pull_quote !== undefined) guide.pullQuote = row.pull_quote;
  return guide;
}

/**
 * A stored row as the guide the site expects, or null if it would not validate.
 *
 * Logs the reason on null: a row that cannot be served is an operational
 * problem (something wrote past the validator), and the slug plus the first
 * failing field is what makes it fixable.
 */
export function rowToGuide(row: GuideRow): GuideV2 | null {
  try {
    return validateGuide(row.slug, toContract(row));
  } catch (e) {
    console.error(`[guides] stored row "${row.slug}" does not validate:`, (e as Error).message);
    return null;
  }
}

/** A validated guide as the columns to upsert. `status` and `updated_at` are the caller's. */
export function guideToRow(guide: GuideV2): Omit<GuideRow, "status" | "created_at" | "updated_at"> {
  return {
    slug: guide.slug,
    feature: guide.feature,
    title: guide.title,
    description: guide.description,
    published_on: guide.publishedOn,
    cid: guide.cid,
    h2s: guide.h2s,
    body_markdown: guide.bodyMarkdown,
    takeaways: guide.takeaways,
    pull_quote: guide.pullQuote ?? null,
    cover: guide.cover,
    visuals: guide.visuals,
  };
}

/** One row of `GET /api/guides?format=export` — the full object plus its row state. */
export type GuideExport = Record<string, unknown> & { status: string; updatedAt: string };

/**
 * A row for the nightly export.
 *
 * Unlike the public reads this does NOT drop a row that fails validation: the
 * export is the file copy that exists so the database is not the only place a
 * guide lives, and a backup that silently omits the one broken row is the worst
 * backup there is. The row is handed over as it stands and the problem is
 * logged, so the export never 500s either.
 */
export function rowToExport(row: GuideRow): GuideExport {
  const problems = guideErrors(row.slug, toContract(row));
  if (problems.length) console.error(`[guides] exporting an invalid row: ${problems[0]}`);
  return { ...toContract(row), status: row.status, updatedAt: row.updated_at };
}
