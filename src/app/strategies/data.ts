// The TradingView strategy scripts. Extracted from page.tsx (22 Oct) so
// /welcome can count them without importing a page module.

export interface Strategy {
  slug: string;
  name: string;
  type: string;
  signal: string;
  tvUrl: string;
  cover: string;
}

export const STRATEGIES: Strategy[] = [
  {
    slug: "mm-ama-supertrend",
    name: "MM AMA SuperTrend",
    type: "Trend",
    signal: "An adaptive-MA SuperTrend — trend direction, flip levels and long/short triggers, backtested on gold.",
    tvUrl: "https://www.tradingview.com/script/vHt8dWZt-MM-AMA-SuperTrend/",
    cover: "/strategies/mm-ama-supertrend.jpg",
  },
  {
    slug: "mm-system-5m-entry",
    name: "MM System 5m Entry",
    type: "Entry",
    signal: "The 5-minute entry model in code — HTF bias, sell/buy zones and confirmation, the MM workflow automated.",
    tvUrl: "https://www.tradingview.com/script/gzyYtuwj-MM-System-5m-Entry/",
    cover: "/strategies/mm-system-5m-entry.jpg",
  },
];
