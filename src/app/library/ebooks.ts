// The 4 ebooks. The public-facing slug (clean URL) is decoupled from the
// actual Storage object name, so the delivery route maps slug -> file. Shared
// by /library and the delivery route so the page and the whitelist can't drift.

// Case-sensitive Supabase Storage bucket id. Must match the bucket exactly
// AND the bucket_id in the ebooks storage RLS policy.
export const EBOOKS_BUCKET = "eBooks";

/** Cover treatment — keeps each book visually distinct on the shelf. */
export type EbookTone = "ink" | "peach" | "paper";

export interface Ebook {
  title: string;
  slug: string;
  blurb: string;
  /** Exact object name in the EBOOKS_BUCKET bucket. */
  file: string;
  /** Display-only fields (not used by the delivery route). */
  category: string;
  tone: EbookTone;
  /** The cornerstone book — rendered as the featured flagship. */
  featured?: boolean;
  /** "What's inside" bullets, shown on the flagship only. */
  whatsInside?: string[];
}

export const EBOOKS: Ebook[] = [
  {
    title: "The MM System (eBook)",
    slug: "mm-system-ebook",
    blurb:
      "The full written system, start to finish — every stage of the workflow in one reference you can keep coming back to.",
    file: "MM_System_eBook.pdf",
    category: "Complete system",
    tone: "ink",
    featured: true,
    whatsInside: [
      "Bias → zone → trigger → risk → manage",
      "Worked gold (XAU/USD) examples",
      "The full decision framework, end to end",
    ],
  },
  {
    title: "The Five-Stage Workflow",
    slug: "five-stage-workflow",
    blurb: "The MM System end to end — bias, zone, trigger, risk, manage.",
    file: "01_The_Five_Stage_Workflow.pdf",
    category: "Core",
    tone: "peach",
  },
  {
    title: "Decision Trees & Invalidation",
    slug: "decision-trees-invalidation",
    blurb: "When the thesis breaks — where the stop sits and why.",
    file: "02_Decision_Trees_and_Invalidation.pdf",
    category: "Core",
    tone: "ink",
  },
  {
    title: "Cheat Sheets & Quick Reference",
    slug: "cheat-sheets-quick-reference",
    blurb: "The desk reference for sessions, levels, and checklists.",
    file: "03_Cheat_Sheets_and_Quick_Reference.pdf",
    category: "Quick-start",
    tone: "paper",
  },
];

const BY_SLUG = new Map(EBOOKS.map((e) => [e.slug, e]));

/** Resolve a slug to its ebook (whitelist guard) — undefined if unknown. */
export function ebookBySlug(slug: string): Ebook | undefined {
  return BY_SLUG.get(slug);
}
