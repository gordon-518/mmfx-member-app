import type { ComponentType, SVGProps } from "react";
import {
  AnalysisIcon, DeskIcon, SignalsIcon, IndicatorsIcon, StrategiesIcon,
  LiveIcon, StyleIcon, CourseIcon, LibraryIcon,
} from "@/components/icons";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export interface RailCard {
  key: string;
  title: string;
  blurb: string;
  href: string;
  icon: Icon;
}

export interface RailStage {
  n: number;
  label: string;
  tagline: string;
  cards: RailCard[];
}

// The dashboard's spine: the profitable-trader workflow. The three stages sell
// the hook — MMFX gives a trader everything from read to execution to managing
// the open position. Foundations is the skill that sits under all three.
export const STAGES: RailStage[] = [
  {
    n: 1,
    label: "Analysis",
    tagline: "Read the market",
    cards: [
      { key: "daily-analysis", title: "Daily Analysis", blurb: "Session-by-session read on gold", href: "/daily-analysis", icon: AnalysisIcon },
      { key: "fundamental-desk", title: "Fundamental Desk", blurb: "Live macro read on XAU/USD", href: "/bots/fundamental", icon: DeskIcon },
    ],
  },
  {
    n: 2,
    label: "Execution",
    tagline: "Find & place the trade",
    cards: [
      { key: "signals", title: "Signals", blurb: "High-conviction calls", href: "/signals", icon: SignalsIcon },
      { key: "indicators", title: "Indicators", blurb: "10 tools on TradingView", href: "/indicators", icon: IndicatorsIcon },
      { key: "strategies", title: "Strategies", blurb: "Backtestable setups", href: "/strategies", icon: StrategiesIcon },
    ],
  },
  {
    n: 3,
    label: "Trade Management",
    tagline: "Manage the position",
    cards: [
      { key: "live-classes", title: "Live Classes", blurb: "Twice-weekly, on the charts", href: "/live-classes", icon: LiveIcon },
      { key: "know-your-style", title: "Know Your Style", blurb: "Find your trader archetype", href: "/bots/know-your-style", icon: StyleIcon },
    ],
  },
];

export const FOUNDATIONS: RailCard[] = [
  { key: "course", title: "The MM System Course", blurb: "Basic to advanced · 19 lessons", href: "/course", icon: CourseIcon },
  { key: "library", title: "eBook Library", blurb: "The written system & references", href: "/library", icon: LibraryIcon },
];
