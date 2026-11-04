// Locked feature pages, the lock veil and the members-only panel. Compliance:
// say what each tool is, never what it earns.
export const locked = {
  features: {
    indicators: {
      eyebrow: "Tools · TradingView",
      title: "Indicators",
      pitch: "The MM System's invite-only TradingView indicators, granted straight to your TradingView username.",
      points: {
        p1: "Auto trendlines, pivots and multi-timeframe views",
        p2: "On your own charts, in TradingView",
        p3: "Access granted automatically",
      },
    },
    strategies: {
      eyebrow: "Tools · TradingView",
      title: "Strategies",
      pitch: "Backtestable TradingView strategy scripts that encode the MM System's rules.",
      points: {
        p1: "Run the rules over history yourself",
        p2: "Entry models from the course, as code",
        p3: "On your own charts, in TradingView",
      },
    },
    library: {
      eyebrow: "Education · Library",
      title: "MM Library",
      pitch: "The four MM eBooks: the system, its playbooks and the thinking behind them.",
      points: {
        p1: "The MM System, written down",
        p2: "Playbooks you can keep beside the chart",
        p3: "Download and read offline",
      },
    },
    "live-classes": {
      eyebrow: "Education · Live",
      title: "Live Classes",
      pitch: "Sessions on the charts with the desk, reading the market as it moves.",
      points: {
        p1: "Live on the charts with the desk",
        p2: "Ask questions as it happens",
        p3: "Replays of past sessions",
      },
    },
    "fundamental-desk": {
      eyebrow: "Bots · Macro",
      title: "Fundamental Desk",
      pitch: "A live macro read on gold: the fundamental picture driving XAU/USD, in plain English.",
      points: {
        p1: "What's moving gold today, and why",
        p2: "Rates, the dollar and risk in one read",
        p3: "Updated through the session",
      },
    },
    "ai-trading-assistant": {
      eyebrow: "Team MM · AI",
      title: "AI Trading Assistant",
      pitch: "Connect your trading account and get a coach that reviews every trade you take against the MM System.",
      points: {
        p1: "Every trade reviewed automatically",
        p2: "Patterns in your own trading, spotted for you",
        p3: "Built around the MM System",
      },
    },
    "team-mm": {
      eyebrow: "Team MM · Community",
      title: "Team MM",
      pitch: "The private Team MM channel, with the desk.",
      points: {
        p1: "Straight from the desk",
        p2: "Team MM members only",
        p3: "On Telegram",
      },
    },
  },
  fallbackTitle: "This part of the desk is locked",
  fallbackPitch: "It opens when you fund your account.",
  openOnEvery: "Open on every plan",
  openNow: "Open on your plan right now",
  freeSignals: "Signals channel",
  freeNews: "News",
  freeCourse: "Course · Module 1",
  membersOnly: "Members only",
  membersTitle: "{feature} is for MM System members",
  perkTeam: "Team MM — the private VIP signals channel",
  perkJournal: "The AI trading journal",
  perkEas: "Automated EAs — coming soon",
  become: "Become a member",
  trialNote: "You're on a free trial — fund your own broker account to unlock everything.",
} as const;
