// What's actually in the app, counted from the content itself rather than
// written down — a number here can never drift from what a member finds when
// they open the page. /welcome shows these so "what do I get" has an answer
// before anyone has clicked anything.

import { LESSONS, MODULES, LEVELS } from "@/app/course/courseData";
import { INDICATORS } from "@/app/indicators/data";
import { STRATEGIES } from "@/app/strategies/data";
import { EBOOKS } from "@/app/library/ebooks";
import { FA_INSTRUMENTS } from "@/lib/fa/types";
import { ARCHETYPES } from "@/lib/kys/archetypes";
import { DIMENSIONS } from "@/lib/kys/dimensions";
import { FEATURE_KEYS } from "@/lib/access/featureKeys";

export const INVENTORY = {
  lessons: LESSONS.length,
  modules: MODULES.length,
  levels: LEVELS.length,
  indicators: INDICATORS.length,
  strategies: STRATEGIES.length,
  ebooks: EBOOKS.length,
  instruments: FA_INSTRUMENTS.length,
  archetypes: ARCHETYPES.length,
  dimensions: DIMENSIONS.length,
  tools: FEATURE_KEYS.length,
} as const;

export type InventoryStatKey = "lessons" | "indicators" | "strategies" | "instruments" | "ebooks" | "archetypes";

export interface InventoryStat {
  key: InventoryStatKey;
  n: number;
  href: string;
  /** Placeholder values for the stat's sub-line (welcome.stats.<key>.sub). */
  vars?: Record<string, number>;
}

/** The headline numbers, in the order they're shown. Words: welcome.stats.<key>. */
export const INVENTORY_STATS: readonly InventoryStat[] = [
  { key: "lessons", n: INVENTORY.lessons, href: "/course", vars: { modules: INVENTORY.modules, levels: INVENTORY.levels } },
  { key: "indicators", n: INVENTORY.indicators, href: "/indicators" },
  { key: "strategies", n: INVENTORY.strategies, href: "/strategies" },
  { key: "instruments", n: INVENTORY.instruments, href: "/bots/fundamental" },
  { key: "ebooks", n: INVENTORY.ebooks, href: "/library" },
  { key: "archetypes", n: INVENTORY.archetypes, href: "/bots/know-your-style", vars: { n: INVENTORY.dimensions } },
];
