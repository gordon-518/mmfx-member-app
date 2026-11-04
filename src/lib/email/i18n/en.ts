// The words of every member email, in English. The other four languages fill
// the same shape (types.ts), so a line missing from one is a type error.
//
// Kept out of the app's dictionaries (src/i18n/messages) on purpose: those
// ship to the browser with every page, and no page shows an email.
//
// Rules every language follows: emails are signed by Don, never Gordon; "MM
// Desk", "Fundamental Desk" and the tier names (Free, Foundation, Desk, Team
// MM) stay in English; nothing promises profit, returns or income. The risk
// lines are the one place English is kept beside a translation — see
// riskLines() in index.ts.
//
// The English here is the code default the lifecycle variants are measured
// against (DEFAULT_COPY): change a `copy` block and you have changed arm A.

export const en = {
  common: {
    /** First word of the first name only. */
    hi: "Hi {name},",
    hiNoName: "Hi,",
    signoff: "— Don, Market Makers FX",
    bias: { bullish: "Bullish", bearish: "Bearish", neutral: "Neutral" },
    biasLine: "Bias: {bias}",
    /** Under anything the desk wrote, in the languages it doesn't write in. Empty in English. */
    deskWritesEnglish: "",
  },

  shell: {
    footerNote: "You're getting this because you have a Market Makers FX account.",
    unsubscribe: "Unsubscribe",
    /** The marketing footer's risk line. */
    riskLine: "Trading involves risk, including the possible loss of capital. Nothing here is financial advice.",
    contextDay: "DAY {day} / 14",
    contextMember: "MEMBER",
    contextDesk: "DESK · XAU/USD",
  },

  tracker: {
    title: "YOUR FIRST 14 DAYS",
    textTitle: "Your first 14 days:",
    today: "TODAY",
    day: "DAY {day}",
    textDay: "(day {day})",
    done: "Done",
    notDone: "Not done yet",
    steps: {
      analysis: "Read today's Daily Analysis",
      kys: "Know Your Style — 3 minutes",
      tv: "Connect TradingView",
      lesson1: "Lesson 1 — Golden Mindset",
      desk: "See what each tier opens",
    },
  },

  ladder: {
    /** Foundation, Desk and Team MM are names and stay in English; "Free" is a plain word. */
    rungs: {
      free: { name: "Free", amount: "no deposit", line: "Daily Analysis, Know Your Style, calendar, news, Module 1" },
      foundation: { name: "Foundation", amount: "$50", line: "the full course and the MM Library" },
      desk: { name: "Desk", amount: "$200", line: "indicators, strategies, live classes, Fundamental Desk" },
      team: { name: "Team MM", amount: "$500", line: "the Team MM channel and the AI Trading Assistant" },
    },
    note: "Each figure is a deposit into your own account at a partner broker, in your name and yours to withdraw.",
  },

  lifecycle: {
    welcome: {
      copy: {
        subject: "Start with today's gold read",
        preheader: "One page on XAU/USD, worked from the daily chart. Three minutes is all it asks.",
        paragraphs: [
          "Start here: open today's Daily Analysis. One page on gold, worked top-down from the daily chart. Three minutes, and you will know how the desk is reading price this session.",
          "It publishes every trading day. This is a desk, not a course library, so the read exists for you to argue with and build your own view rather than borrow ours.",
          "Your 14-day trial is open now, and access costs you nothing. We are an introducing broker, so the broker pays us when you trade. Any deposit goes into your own account, in your name, and stays yours. After day 14, the daily read, Know Your Style and Module 1 of the course stay open.",
        ],
        ctaLabel: "Open today's analysis",
      },
      heroEyebrow: "Welcome to the desk",
      heroHeadline: "READ THE MARKET.\nTHEN ACT ON IT.",
      /** {title} is the desk's own headline, {bias} the bias word. */
      todayRead: "Today's read is {title} — {bias} bias.",
      todayReadNoBias: "Today's read is {title}.",
      noRead: "Today's read goes up during the Asian session. It's the first thing to check each morning.",
    },
    analysis: {
      copy: {
        subject: "Today's read on gold",
        preheader: "Written before the session opens. A short video, a PDF, and the levels being watched.",
        paragraphs: [
          "Every trading morning the desk writes down its read on gold before the session opens. Today's is above, with the bias it is working from.",
          "A short video and a PDF. Where price sat overnight, and the levels the desk is watching.",
          "You do not have to agree with it. Hold it against your own chart and see where the two differ.",
        ],
        ctaLabel: "Open today's analysis",
      },
      todayUp: "Today's is up: {title}, bias {bias}.",
      noRead: "The next one goes up before the session.",
    },
    kys: {
      copy: {
        subject: "Eight archetypes. One is yours.",
        preheader: "Three minutes of questions, then the habit you are least likely to see in yourself.",
        paragraphs: [
          "Know Your Style asks a short set of questions and names your archetype. There are eight. It takes about three minutes.",
          "What comes back is the set of habits that travels with that archetype, including the one most traders cannot see in themselves.",
          "It is yours to keep. From then on your dashboard and the tier page read it, and point you at the work that suits how you actually trade.",
        ],
        ctaLabel: "Take Know Your Style",
      },
    },
    tv: {
      copy: {
        subject: "Your TradingView username",
        preheader: "TradingView grants access per username, and yours is the one field we don't have.",
        paragraphs: [
          "The ten Market Makers indicators are ready on our side. TradingView grants access per username, so yours is the one thing missing.",
          "Add it on the indicators page. Access is granted automatically, and the ten appear on your charts within one to three hours.",
          "One field, about ten seconds. Nothing else about the indicators moves until it is there.",
        ],
        ctaLabel: "Add your username",
      },
    },
    lesson1: {
      copy: {
        subject: "Start with Golden Mindset",
        preheader: "Lesson one of Module 1. The other eighteen can wait for a weekend that never comes.",
        paragraphs: [
          "Nineteen lessons is the kind of number people put off. So ignore the number. Today there is one lesson.",
          "Golden Mindset opens Module 1. It is the discipline the rest of the system stands on, and everything after it assumes you have it. A video, with the slide deck beside it.",
          "Module 1 sits on every account here, deposit or not. Open the lesson. You can stop after it.",
        ],
        ctaLabel: "Watch Golden Mindset",
      },
    },
    ladder: {
      copy: {
        subject: "The ladder, and what each rung opens",
        preheader: "Free keeps Daily Analysis forever. The amounts are deposits into your own account.",
        paragraphs: [
          "Nine days in. Here is the map of how access works here. No pitch attached: read it and do nothing.",
          "The amounts are not prices and are not paid to Market Makers. Each is a deposit into a trading account at a partner broker, opened in your name. You hold it, you trade with it, and you can withdraw it.",
          "Your cumulative deposit sets your rung, and it is a high-water mark, so a drawdown never removes access. Free keeps Daily Analysis, Know Your Style, the calendar and Module 1 with no deposit at all.",
        ],
        ctaLabel: "See what each rung opens",
      },
    },
    day12: {
      copy: {
        subject: "What closes on day 14",
        preheader: "Daily Analysis, Know Your Style and Module 1 stay. Nothing is deleted, nothing charged.",
        paragraphs: [
          "Day 14 ends the trial. What closes: the ten TradingView indicators, the strategy scripts, live classes, the Fundamental Desk, and the lessons past Module 1.",
          "What stays, with no deposit at all: Daily Analysis every trading day, Know Your Style, Module 1, the economic calendar, the news feed and the public signals channel. Your login keeps working.",
          "Each rung above Free is a deposit into your own trading account at the broker, opened in your name, yours to trade and withdraw. The tiers page shows which rung opens what.",
        ],
        ctaLabel: "See what each rung opens",
      },
    },
    digest: {
      /** `{bias}` and `{title}` are substituted; see subjectFor(). */
      copy: {
        subject: "Gold today: {bias}",
        preheader: "The overnight range, the levels the desk is watching, and where it stands now.",
        paragraphs: [] as string[],
        ctaLabel: "Read today's analysis",
      },
      keeps:
        "Daily Analysis stays open on your free account, along with Know Your Style, the economic calendar, live news and Module 1 of the MM System course. Nothing to do and nothing to pay — it's there every trading day.",
      fallbackTitle: "Today's XAU/USD read",
      fallbackHeadline: "The desk's read on gold today",
    },
    spotlight: {
      copy: {
        subject: "This week's guide from the desk",
        preheader: "One read on gold, start to finish. Open on the free tier, no deposit needed.",
        paragraphs: [
          "This week's guide isn't out yet, so here's what's always there: the desk's read on gold, posted every trading morning.",
          "Where price sat overnight, the levels the desk is watching, and the bias it's working from. It's on your account whether you deposit or not.",
        ],
        ctaLabel: "Read this week's guide",
      },
      ladder:
        "Everything in this one is on the free side of your account. The paid rungs start at a $50 deposit into your own trading account, and the tier page says what each opens.",
      fallbackCta: "Open today's analysis",
      /** Above the guide in the languages the guide isn't written in. Empty in English. */
      guideInEnglish: "",
    },
    upgradeSeen: {
      copy: {
        subject: "The deposit stays in your name",
        preheader: "Not a payment to us. It is trading capital at a broker, yours to hold and withdraw.",
        paragraphs: [
          "You opened the tier page two days ago and left it there. The sticking point is usually the same one, so here it is plainly.",
          "The deposit is not paid to Market Makers. It goes into a trading account opened in your name, under your login. You hold it, you trade with it, you can withdraw it.",
          "On our side it only sets your rung. The total counts cumulatively and holds at its high-water mark, so a drawdown never takes back access you already have. The page reads differently with that in mind.",
        ],
        ctaLabel: "Read the tiers again",
      },
    },
    brokerClicked: {
      copy: {
        subject: "Half way through the broker form",
        preheader: "Amelia does these every day. Tell her where you stopped and she takes it from there.",
        paragraphs: [
          "You opened the broker account page yesterday and stopped somewhere in the middle. That happens often enough that we keep a person for it.",
          "The form asks for an identity document and a proof of address. Uploads get rejected for small reasons. Forms ask for things you did not have to hand.",
          "Message Admin Amelia on Telegram and say where you stopped. She cannot write to you first, so the first line has to be yours. If you have changed your mind, that is a fine answer. The free side of your account stays as it is.",
        ],
        ctaLabel: "Message Admin Amelia",
      },
    },
    memberD3: {
      copy: {
        subject: "Connect the AI Trading Assistant",
        preheader: "Read-only access to your closed trades. One connection, about three minutes.",
        paragraphs: [
          "The assistant is already on your tier. Until an account is linked it has nothing to read, which is why it is usually the feature that never gets used.",
          "Link your trading account and it reads your closed trades, then shows you your own record back: how long you hold, what you do in the hour after a loser, which setups you keep taking.",
          "The link is read-only. It can see the account's history and it cannot place, size or close anything. It gets more useful the more trades it has, so today is worth more than next month.",
        ],
        ctaLabel: "Connect the assistant",
      },
      cardName: "AI Trading Assistant",
      cardLine: "Read-only. It shows you your own record back.",
    },
    memberD7: {
      copy: {
        subject: "The Fundamental Desk, open today",
        preheader: "What is actually moving gold this week: the dollar, real yields, one calendar line",
        paragraphs: [
          "A week in, you have found the indicators. The Fundamental Desk is the half that gets opened less often, so here it is.",
          "It is a plain read on what is driving gold right now: the dollar, real yields, what the central banks are signalling, and the one line on this week's calendar that matters.",
          "Open it before your next session. Live classes with the desk sit beside it in the app, on your tier already.",
        ],
        ctaLabel: "Open the Fundamental Desk",
      },
      cardName: "Fundamental Desk",
      cardLine: "The macro picture behind the move, in plain English.",
    },
    memberDormant: {
      copy: {
        subject: "Today's read on gold",
        preheader: "A quiet month is fine. One read, three minutes, no catching up required.",
        paragraphs: [
          "Your account has been quiet for about a month. No pitch in this one. Markets are easier to walk away from than to come back to.",
          "The desk kept writing every trading morning: where gold sat overnight, the levels it is watching, the bias it is working from. A short video and a PDF, before the session.",
          "Start with today's, not a month of them. It is already on your account. And if Market Makers is not for you any more, unsubscribe below and we will leave you alone.",
        ],
        ctaLabel: "Open today's analysis",
      },
      cardName: "Daily Analysis",
      cardLine: "The desk's read on gold, every trading morning.",
    },
  },

  deposit: {
    /** The deposit emails' risk line (worded for the deposit context). */
    riskLine: "Trading involves risk, including the possible loss of capital. No returns are guaranteed.",
    deposit: "deposit",
    topUp: "top-up",
    verified: {
      subject: "Verified: you're on {tier}",
      /** {amount} and {tier} are bold in the HTML; {what} is "deposit" or "top-up". */
      body: "Your {amount} {what} is verified. You're on {tier}, with {cumulative} in deposits so far, and your desk is open now.",
      unlocked: "Everything on your tier is unlocked. Open the desk: {url}",
      cta: "Open your desk",
    },
    reminder: {
      subject: "One last step for your {amount} deposit",
      /** {amount} is bold in the HTML. */
      body: "Your {amount} deposit is in for review. One step is left: send {admin} a message on Telegram.",
      why: "Our admin can't message you first, so it's how we reach you if anything about your deposit needs checking.",
      textLink: "Message {admin}: {url}",
      cta: "Message {admin} on Telegram",
      /** {ref} is bold in the HTML. */
      ref: "Your reference is {ref}. It's already in the message.",
    },
    rejected: {
      subject: "About your deposit submission",
      /** {amount} is bold in the HTML; {reason} is what the reviewer typed, as typed. */
      body: "We couldn't verify your {amount} deposit yet: {reason}",
      text: "You can submit it again from {url}, or message us on WhatsApp or Telegram and we'll sort it out with you.",
      cta: "Submit it again",
      other: "Or message us on WhatsApp or Telegram and we'll sort it out with you.",
    },
  },

  fundamental: {
    subject: "Your {instrument} fundamental thesis",
    title: "MMFX Fundamental Dispatch",
    kicker: "Terminal Dispatch · Fundamental Desk",
    /** {instrument} is bold in the HTML. */
    attached: "Your {instrument} fundamental thesis is attached.",
    inside: "Inside: the current macro read driving the pair — positioning, the catalysts in play, and the bias they point to. Open the attached PDF for the full dispatch.",
    compliance: "Fundamental analysis only — not a signal, target, or instruction to buy/sell.",
    footer: "You're receiving this because you requested a copy from the Fundamental Desk inside your Market Makers FX account.",
  },

  journal: {
    doThis: "Do this:",
    cta: "Open your AI Trading Assistant",
    footerNote: "You're getting this because you track your trading with Market Makers FX.",
  },
};
