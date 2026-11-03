// The guided tour's words, by step key (components/tour/steps.ts holds the
// structure: which element each stop points at).
export const tour = {
  dialogLabel: "How to use the app",
  close: "Close the tour",
  stepOf: "Step {n} of {total}",
  steps: {
    intro: {
      title: "Let me show you around",
      body: "Nine quick stops, about two minutes. By the end you'll know where everything lives and what each part is for. You can leave at any point.",
    },
    nav: {
      title: "Everything is in this one menu",
      body: "The whole desk lives down the left, grouped the way you'd actually use it: read the market, execute, manage the trade, and the foundations under all three.",
    },
    home: {
      title: "Start here and Dashboard",
      body: "Start here is the page you're on: your six steps and your progress. Dashboard is the daily home — what's new, and what to do next.",
    },
    read: {
      title: "Read the market",
      body: "Open a session with these. Daily Analysis is the desk's read on gold with the levels; the Fundamental Desk reads the macro across eleven instruments; News and the Calendar tell you what's coming.",
    },
    execute: {
      title: "Execute",
      body: "Where a plan becomes a trade. Signals are the desk's calls, the Indicators put our tools on your own TradingView chart, and the Strategies are the system written as scripts.",
    },
    manage: {
      title: "Manage the trade",
      body: "The hardest part, and where most accounts are lost. Live Classes trade it with you, Know Your Style finds the habit costing you, and the AI Trading Assistant reviews your real trades.",
    },
    foundations: {
      title: "The foundations",
      body: "The MM System course — nineteen lessons from mindset to managing the position — and the written library behind it. Come back to these whenever something above doesn't make sense.",
    },
    account: {
      title: "Your plan lives here",
      body: "Your tier is shown under your email. A padlock next to any menu item means it opens on a higher tier — tap it and you'll see exactly what's inside before deciding anything.",
    },
    steps: {
      title: "Then just work down the list",
      body: "Your six steps, in order, each with what it gets you and the target to hit after it. One a day is plenty.",
    },
    done: {
      title: "That's the desk",
      body: "You can run this tour again any time from the button at the top of Start here. Step one is joining the public channel — it takes about ten seconds.",
    },
  },
} as const;
