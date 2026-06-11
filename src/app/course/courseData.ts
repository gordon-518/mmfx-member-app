// The 19 course lessons — source of truth is docs/course-videos.md.
// Thumbnails are PUBLIC card art at /course/<slug>.png. Videos stream from
// Gumlet (gated by the page + Gumlet domain-restriction). PPT decks are GATED
// in the private `slides` Storage bucket, served via /api/slides/<slug>.
//
// server-only: this module carries pptFile (storage object names) and the
// bucket id — it must never be bundled into a client component. The page
// strips pptFile before passing lessons to CourseClient. (CourseClient only
// imports `type CourseLevel`, which is erased at compile time.)
import "server-only";

export const SLIDES_BUCKET = "slides";

export type CourseLevel = "Basic" | "Intermediate" | "Advanced";

export const LEVELS: CourseLevel[] = ["Basic", "Intermediate", "Advanced"];

export interface Lesson {
  slug: string;
  number: number;
  title: string;
  level: CourseLevel;
  description: string;
  gumletId: string;
  /** Exact object name in the SLIDES_BUCKET bucket. */
  pptFile: string;
}

export const LESSONS: Lesson[] = [
  { slug: "00-golden-mindset", number: 0, level: "Basic", title: "Golden Mindset", gumletId: "69eb641b80df8787f2ad0bca", pptFile: "basic_v1_gold_mindset.pptx", description: "The trader's mindset before the mechanics — discipline, patience, and the psychology behind consistent execution." },
  { slug: "01-xauusd-explained", number: 1, level: "Basic", title: "XAUUSD Explained", gumletId: "69ec6ac14779ed7c8b5d4e56", pptFile: "basic_v2_xauusd_explained.pptx", description: "Gold as a tradable instrument — why XAUUSD moves differently from forex pairs." },
  { slug: "02-what-moves-gold", number: 2, level: "Basic", title: "What Moves Gold?", gumletId: "69f4801bc530a8d6d2ce56dc", pptFile: "basic_v3_what_moves_gold.pptx", description: "The macro drivers of gold prices — the US Dollar, real yields, risk sentiment, and geopolitical tension." },
  { slug: "03-market-structure-pt1", number: 3, level: "Basic", title: "Market Structure Part 1", gumletId: "69f4801b1dfaccdc955347b4", pptFile: "basic_v4_market_structure.pptx", description: "Reading higher-highs and higher-lows — how to identify trend direction from price action alone." },
  { slug: "04-market-structure-pt2", number: 4, level: "Basic", title: "Market Structure Part 2", gumletId: "69f4801bc530a8d6d2ce56da", pptFile: "basic_v5_structure_mistakes.pptx", description: "Internal vs external structure, and the critical difference between a Break of Structure (BOS) and a Change of Character (CHoCH)." },
  { slug: "05-core-concepts", number: 5, level: "Basic", title: "MM Core Concepts", gumletId: "69f4801bc530a8d6d2ce56fa", pptFile: "basic_v6_core_concepts.pptx", description: "The pillars of the MM System at a glance — liquidity, order blocks, fair value gaps, and displacement." },
  { slug: "06-liquidity-deep-dive", number: 6, level: "Intermediate", title: "Liquidity Deep Dive", gumletId: "69f4801b609709b32f6556c0", pptFile: "int_v1_liquidity_deep_dive.pptx", description: "Where institutional orders hide — buyside/sellside liquidity, equal highs/lows, and how to spot a sweep in real time." },
  { slug: "07-displacement-mastery", number: 7, level: "Intermediate", title: "Displacement Mastery", gumletId: "69f48269c530a8d6d2ce8ab3", pptFile: "int_v2_displacement_mastery.pptx", description: "What separates real institutional intent from noise — body size, consecutive candles, FVGs, and structural breaks." },
  { slug: "08-daily-bias-pt1", number: 8, level: "Intermediate", title: "Daily Bias Part 1", gumletId: "69f48269609709b32f658b51", pptFile: "int_v3_daily_bias_pt1.pptx", description: "Calling direction for the day — mapping external liquidity on Daily and 4H, and defining your target." },
  { slug: "09-daily-bias-pt2", number: 9, level: "Intermediate", title: "Daily Bias Part 2", gumletId: "69f48269609709b32f658b57", pptFile: "int_v4_daily_bias_pt2.pptx", description: "Timeframe alignment, invalidation levels, and what to do when higher timeframes disagree." },
  { slug: "10-15m-decision", number: 10, level: "Intermediate", title: "15m Decision Framework", gumletId: "69f4826a1dfaccdc95537cda", pptFile: "int_v5_15min_decision.pptx", description: "The 15-minute playbook — trend day vs reversal day, and how to mark your entry zone (OB/FVG)." },
  { slug: "11-5m-confirmation", number: 11, level: "Intermediate", title: "5m Confirmation Framework", gumletId: "69f483051dfaccdc95538abc", pptFile: "int_v6_5min_confirmation.pptx", description: "Waiting for a 5m CHoCH with displacement inside your 15m zone — the permission slip to drop to 1m." },
  { slug: "12-sessions", number: 12, level: "Intermediate", title: "Sessions and Time of Day", gumletId: "69f48305609709b32f6599ce", pptFile: "int_v7_sessions_time.pptx", description: "Asian accumulation, London manipulation, New York distribution — and the kill zones." },
  { slug: "13-1m-execution", number: 13, level: "Advanced", title: "1m Execution Framework", gumletId: "69f4801b609709b32f655691", pptFile: "adv_v1_1min_execution.pptx", description: "The final entry trigger — 1m CHoCH or confirmation inside the Optimal Trade Entry (OTE) zone." },
  { slug: "14-breaker-blocks", number: 14, level: "Advanced", title: "Breaker Blocks Mastery", gumletId: "69f4801b609709b32f655693", pptFile: "adv_v2_breaker_blocks.pptx", description: "Failed order blocks that flip role — one of the highest-probability zones in the entire MM System." },
  { slug: "15-news-macro", number: 15, level: "Advanced", title: "News, Macro, Geopolitical Drivers", gumletId: "69f4801b1dfaccdc955347b1", pptFile: "adv_v3_news_macro.pptx", description: "Handling CPI, FOMC, NFP and geopolitical shocks — pre-event prep, kill rules, and when to stand aside." },
  { slug: "16-trade-management", number: 16, level: "Advanced", title: "Trade Management", gumletId: "69f4801b609709b32f6556ba", pptFile: "adv_v4_trade_management.pptx", description: "Break-even triggers, partial profits, trailing, and scaling — how to let winners run without giving it back." },
  { slug: "17-complete-workflow", number: 17, level: "Advanced", title: "Complete Workflow", gumletId: "69f4801b609709b32f65568f", pptFile: "adv_v5_complete_workflow.pptx", description: "Every step from blank chart to closed trade — the full MM System in one end-to-end session." },
  { slug: "18-daily-sop", number: 18, level: "Advanced", title: "Your Daily SOP", gumletId: "69f4801b1dfaccdc955347c7", pptFile: "adv_v6_daily_sop.pptx", description: "The 8-step ritual for every trading day — mark, bias, classify, wait, confirm, execute, manage, journal." },
];

const BY_SLUG = new Map(LESSONS.map((l) => [l.slug, l]));

/** Resolve a slug to its lesson (whitelist guard) — undefined if unknown. */
export function lessonBySlug(slug: string): Lesson | undefined {
  return BY_SLUG.get(slug);
}
