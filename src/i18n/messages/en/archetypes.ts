// The eight Know Your Style archetypes, keyed by the ID profiles.kys_archetype
// stores. The English matches src/lib/kys/archetypes.json, which still feeds the
// report prompt (a test keeps the two in step). keystone* is the archetype's
// first "next move" button.
export const archetypes = {
  reckless_gambler: {
    name: "The Reckless Gambler",
    keystoneLabel: "Managing & Routine module",
    keystoneWhy: "Build the risk rules first — fixed sizing and hard stops before anything else.",
  },
  analysis_paralyser: {
    name: "The Analysis Paralyser",
    keystoneLabel: "Backtest a strategy",
    keystoneWhy: "Prove your rules work, so you stop demanding certainty that never comes.",
  },
  signal_dependent: {
    name: "The Signal Dependent",
    keystoneLabel: "Start the MM System Course",
    keystoneWhy: "Turn signal-following into a skill you actually own.",
  },
  indicator_stacker: {
    name: "The Indicator Stacker",
    keystoneLabel: "Reading Price module",
    keystoneWhy: "Trade clean structure instead of a wall of contradicting indicators.",
  },
  emotional_revenge_trader: {
    name: "The Emotional Revenge Trader",
    keystoneLabel: "Read the If-Then eBook",
    keystoneWhy: "Pre-commit your reactions so a loss cannot hijack you.",
  },
  news_trader: {
    name: "The News Trader",
    keystoneLabel: "Economic Calendar",
    keystoneWhy: "Plan around the catalysts instead of chasing every headline.",
  },
  system_hopper: {
    name: "The System Hopper",
    keystoneLabel: "Commit to one system",
    keystoneWhy: "One framework, traded long enough to actually compound.",
  },
  brand_new_beginner: {
    name: "The Brand New Beginner",
    keystoneLabel: "Start at Foundations",
    keystoneWhy: "Build the base before you put any real money at risk.",
  },
} as const;
