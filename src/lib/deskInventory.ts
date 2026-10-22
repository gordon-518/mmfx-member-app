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

export interface InventoryStat {
  n: number;
  label: string;
  sub: string;
  href: string;
}

/** The headline numbers, in the order they're shown. */
export const INVENTORY_STATS: readonly InventoryStat[] = [
  { n: INVENTORY.lessons, label: "video lessons", sub: `${INVENTORY.modules} modules, ${INVENTORY.levels} levels`, href: "/course" },
  { n: INVENTORY.indicators, label: "TradingView tools", sub: "on your own charts", href: "/indicators" },
  { n: INVENTORY.strategies, label: "strategy scripts", sub: "the system, in code", href: "/strategies" },
  { n: INVENTORY.instruments, label: "instruments read daily", sub: "gold, majors and crypto", href: "/bots/fundamental" },
  { n: INVENTORY.ebooks, label: "written references", sub: "the system on paper", href: "/library" },
  { n: INVENTORY.archetypes, label: "trader archetypes", sub: `scored on ${INVENTORY.dimensions} dimensions`, href: "/bots/know-your-style" },
];
