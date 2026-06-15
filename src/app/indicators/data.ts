// The 10 MM indicators. Artwork lives at /indicators/<slug>-cover.png
// (PNGs only — the .pine source is proprietary and never web-served).
// tvUrl: the published TradingView script page (opens in a new tab). Two
// indicators aren't published yet, so their card is non-clickable.

export interface Indicator {
  name: string;
  slug: string;
  type: string;
  signal: string;
  tvUrl?: string;
  /** Set when no <slug>-cover.png exists yet — the card shows a branded fallback. */
  noCover?: boolean;
}

export const INDICATORS: Indicator[] = [
  { name: "MM Squeeze Pulse", slug: "squeeze-pulse", type: "Momentum", signal: "Squeeze release + direction", tvUrl: "https://www.tradingview.com/script/FguarHam-MM-Squeeze-Pulse/" },
  { name: "MM Wave Pressure", slug: "wave-pressure", type: "Oscillator", signal: "Overbought/oversold zone crosses", tvUrl: "https://www.tradingview.com/script/LSzVr7JY-MM-Wave-Pressure/" },
  { name: "MM Structure Map", slug: "structure-map", type: "Structure", signal: "BOS/CHoCH + OB/FVG zones", tvUrl: "https://www.tradingview.com/script/HX9nOiYf-MM-Structure-Map/" },
  { name: "MM Echo Predictor", slug: "echo-predictor", type: "ML Classifier", signal: "Bar-color direction bias", tvUrl: "https://www.tradingview.com/script/cFyNYi1E-MM-Echo-Predictor/" },
  { name: "MM Trend Rail", slug: "trend-rail", type: "Trend", signal: "Trail direction + flip", tvUrl: "https://www.tradingview.com/script/tEs31VWM-MM-Trend-Rail/" },
  { name: "MM Pivot Trend", slug: "pivot-trend", type: "Trend", signal: "Early reversal detection", tvUrl: "https://www.tradingview.com/script/1ztDth3L-MM-Pivot-Trend/" },
  { name: "MM MTF Minicharts", slug: "mtf-minicharts", type: "Multi-Timeframe", signal: "Six timeframes beside live price", tvUrl: "https://www.tradingview.com/script/EFN8WkXI-MM-MTF-Minicharts/" },
  { name: "MM Auto Trendlines", slug: "auto-trendlines", type: "Structure", signal: "Break-and-retest patterns", tvUrl: "https://www.tradingview.com/script/2ovm0ORy-MM-Auto-Trendlines/" },
  { name: "MM Adaptive MA", slug: "adaptive-ma", type: "Trend", signal: "Slope direction + efficiency ratio", tvUrl: "https://www.tradingview.com/script/oM5iK4vt-MM-Adaptive-MA/" },
  { name: "MM Reversion Bands", slug: "reversion-bands", type: "Statistical", signal: "Outer-band stretch signals", tvUrl: "https://www.tradingview.com/script/INJR52ux-MM-Reversion-Bands/" },
];
