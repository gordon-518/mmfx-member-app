// The 4 ebooks. The public-facing slug (clean URL) is decoupled from the
// actual Storage object name, so the delivery route maps slug -> file. Shared
// by /library and the delivery route so the page and the whitelist can't drift.

// Case-sensitive Supabase Storage bucket id. Must match the bucket exactly
// AND the bucket_id in the ebooks storage RLS policy.
export const EBOOKS_BUCKET = "eBooks";

export interface Ebook {
  title: string;
  slug: string;
  blurb: string;
  /** Exact object name in the EBOOKS_BUCKET bucket. */
  file: string;
}

export const EBOOKS: Ebook[] = [
  {
    title: "The Five-Stage Workflow",
    slug: "five-stage-workflow",
    blurb: "The MM System end to end — bias, zone, trigger, risk, manage.",
    file: "01_The_Five_Stage_Workflow.pdf",
  },
  {
    title: "Decision Trees & Invalidation",
    slug: "decision-trees-invalidation",
    blurb: "When the thesis breaks — where the stop sits and why.",
    file: "02_Decision_Trees_and_Invalidation.pdf",
  },
  {
    title: "Cheat Sheets & Quick Reference",
    slug: "cheat-sheets-quick-reference",
    blurb: "The desk reference for sessions, levels, and checklists.",
    file: "03_Cheat_Sheets_and_Quick_Reference.pdf",
  },
  {
    title: "The MM System (eBook)",
    slug: "mm-system-ebook",
    blurb: "The full written system, start to finish.",
    file: "MM_System_eBook.pdf",
  },
];

const BY_SLUG = new Map(EBOOKS.map((e) => [e.slug, e]));

/** Resolve a slug to its ebook (whitelist guard) — undefined if unknown. */
export function ebookBySlug(slug: string): Ebook | undefined {
  return BY_SLUG.get(slug);
}
