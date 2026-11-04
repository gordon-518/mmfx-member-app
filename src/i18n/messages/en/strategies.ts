// The strategies page. Script names are product names and stay as they are.
export const strategies = {
  eyebrow: "Tools · XAU/USD",
  title: "Strategies",
  subtitle: "Backtestable TradingView strategy scripts — entries, exits and risk encoded so you can test them on your own charts. Two are live; more on the way.",
  grantedWhat: "both strategy scripts",
  requestBody: "Enter your TradingView username to get access to both strategy scripts. Access is granted automatically — you'll see them in your account shortly.",
  view: "View on TradingView",
  imageAlt: "{name} backtest on TradingView",
  comingSoon: "Coming soon",
  inBuild: "In build",
  inBuildBody: "Another backtestable setup — added to your member area soon.",
  types: {
    Trend: "Trend",
    Entry: "Entry",
  },
  signals: {
    "mm-ama-supertrend": "An adaptive-MA SuperTrend — trend direction, flip levels and long/short triggers, backtested on gold.",
    "mm-system-5m-entry": "The 5-minute entry model in code — HTF bias, sell/buy zones and confirmation, the MM workflow automated.",
  },
} as const;
