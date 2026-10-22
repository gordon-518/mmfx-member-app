// The guided tour's script. Pure data so it can be tested and so the copy
// lives in one place: every stop points at something that is really on screen
// (the data-tour attributes in AppShell), and a stop whose target isn't
// rendered for this member is skipped rather than pointing at nothing.

export interface TourStep {
  key: string;
  /** The data-tour value to spotlight. Omitted = a centred card. */
  target?: string;
  title: string;
  body: string;
  /** Lives in the sidebar, so the mobile drawer has to be open to see it. */
  inNav?: boolean;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    key: "intro",
    title: "Let me show you around",
    body: "Nine quick stops, about two minutes. By the end you'll know where everything lives and what each part is for. You can leave at any point.",
  },
  {
    key: "nav",
    target: "nav",
    inNav: true,
    title: "Everything is in this one menu",
    body: "The whole desk lives down the left, grouped the way you'd actually use it: read the market, execute, manage the trade, and the foundations under all three.",
  },
  {
    key: "home",
    target: "nav-home",
    inNav: true,
    title: "Start here and Dashboard",
    body: "Start here is the page you're on: your six steps and your progress. Dashboard is the daily home — what's new, and what to do next.",
  },
  {
    key: "read",
    target: "nav-read",
    inNav: true,
    title: "Read the market",
    body: "Open a session with these. Daily Analysis is the desk's read on gold with the levels; the Fundamental Desk reads the macro across eleven instruments; News and the Calendar tell you what's coming.",
  },
  {
    key: "execute",
    target: "nav-execute",
    inNav: true,
    title: "Execute",
    body: "Where a plan becomes a trade. Signals are the desk's calls, the Indicators put our tools on your own TradingView chart, and the Strategies are the system written as scripts.",
  },
  {
    key: "manage",
    target: "nav-manage",
    inNav: true,
    title: "Manage the trade",
    body: "The hardest part, and where most accounts are lost. Live Classes trade it with you, Know Your Style finds the habit costing you, and the AI Trading Assistant reviews your real trades.",
  },
  {
    key: "foundations",
    target: "nav-foundations",
    inNav: true,
    title: "The foundations",
    body: "The MM System course — nineteen lessons from mindset to managing the position — and the written library behind it. Come back to these whenever something above doesn't make sense.",
  },
  {
    key: "account",
    target: "nav-account",
    inNav: true,
    title: "Your plan lives here",
    body: "Your tier is shown under your email. A padlock next to any menu item means it opens on a higher tier — tap it and you'll see exactly what's inside before deciding anything.",
  },
  {
    key: "steps",
    target: "welcome-steps",
    title: "Then just work down the list",
    body: "Your six steps, in order, each with what it gets you and the target to hit after it. One a day is plenty.",
  },
  {
    key: "done",
    title: "That's the desk",
    body: "You can run this tour again any time from the button at the top of Start here. Step one is joining the public channel — it takes about ten seconds.",
  },
];
