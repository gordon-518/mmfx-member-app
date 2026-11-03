// The syllabus in every language. The lessons themselves are videos in English,
// so the technical terms the videos use (BOS, CHoCH, OB, FVG, OTE...) stay
// recognisable in every translation.
export const courseContent = {
  levels: {
    Basic: "Basic",
    Intermediate: "Intermediate",
    Advanced: "Advanced",
  },
  modules: {
    m1: {
      title: "Foundations",
      summary: "Mindset & gold basics",
    },
    m2: {
      title: "Reading Price",
      summary: "Structure & core concepts",
    },
    m3: {
      title: "The Institutional Edge",
      summary: "Liquidity & displacement",
    },
    m4: {
      title: "Building Your Bias",
      summary: "Top-down analysis",
    },
    m5: {
      title: "The Entry Model",
      summary: "Intraday framework to the trigger",
    },
    m6: {
      title: "Managing & Routine",
      summary: "Risk, news & your daily SOP",
    },
  },
  lessons: {
    "00-golden-mindset": {
      title: "Golden Mindset",
      description: "The trader's mindset before the mechanics — discipline, patience, and the psychology behind consistent execution.",
    },
    "01-xauusd-explained": {
      title: "XAUUSD Explained",
      description: "Gold as a tradable instrument — why XAUUSD moves differently from forex pairs.",
    },
    "02-what-moves-gold": {
      title: "What Moves Gold?",
      description: "The macro drivers of gold prices — the US Dollar, real yields, risk sentiment, and geopolitical tension.",
    },
    "03-market-structure-pt1": {
      title: "Market Structure Part 1",
      description: "Reading higher-highs and higher-lows — how to identify trend direction from price action alone.",
    },
    "04-market-structure-pt2": {
      title: "Market Structure Part 2",
      description: "Internal vs external structure, and the critical difference between a Break of Structure (BOS) and a Change of Character (CHoCH).",
    },
    "05-core-concepts": {
      title: "MM Core Concepts",
      description: "The pillars of the MM System at a glance — liquidity, order blocks, fair value gaps, and displacement.",
    },
    "06-liquidity-deep-dive": {
      title: "Liquidity Deep Dive",
      description: "Where institutional orders hide — buyside/sellside liquidity, equal highs/lows, and how to spot a sweep in real time.",
    },
    "07-displacement-mastery": {
      title: "Displacement Mastery",
      description: "What separates real institutional intent from noise — body size, consecutive candles, FVGs, and structural breaks.",
    },
    "08-daily-bias-pt1": {
      title: "Daily Bias Part 1",
      description: "Calling direction for the day — mapping external liquidity on Daily and 4H, and defining your target.",
    },
    "09-daily-bias-pt2": {
      title: "Daily Bias Part 2",
      description: "Timeframe alignment, invalidation levels, and what to do when higher timeframes disagree.",
    },
    "10-15m-decision": {
      title: "15m Decision Framework",
      description: "The 15-minute playbook — trend day vs reversal day, and how to mark your entry zone (OB/FVG).",
    },
    "11-5m-confirmation": {
      title: "5m Confirmation Framework",
      description: "Waiting for a 5m CHoCH with displacement inside your 15m zone — the permission slip to drop to 1m.",
    },
    "12-sessions": {
      title: "Sessions and Time of Day",
      description: "Asian accumulation, London manipulation, New York distribution — and the kill zones.",
    },
    "13-1m-execution": {
      title: "1m Execution Framework",
      description: "The final entry trigger — 1m CHoCH or confirmation inside the Optimal Trade Entry (OTE) zone.",
    },
    "14-breaker-blocks": {
      title: "Breaker Blocks Mastery",
      description: "Failed order blocks that flip role — one of the highest-probability zones in the entire MM System.",
    },
    "15-news-macro": {
      title: "News, Macro, Geopolitical Drivers",
      description: "Handling CPI, FOMC, NFP and geopolitical shocks — pre-event prep, kill rules, and when to stand aside.",
    },
    "16-trade-management": {
      title: "Trade Management",
      description: "Break-even triggers, partial profits, trailing, and scaling — how to let winners run without giving it back.",
    },
    "17-complete-workflow": {
      title: "Complete Workflow",
      description: "Every step from blank chart to closed trade — the full MM System in one end-to-end session.",
    },
    "18-daily-sop": {
      title: "Your Daily SOP",
      description: "The 8-step ritual for every trading day — mark, bias, classify, wait, confirm, execute, manage, journal.",
    },
  },
} as const;
