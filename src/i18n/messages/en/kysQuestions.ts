// Know Your Style's fourteen questions. Only the words are here: the scoring
// lives in src/lib/kys/questions.ts and is identical in every language, and the
// answers are stored by option id (a, b, c...), never by their text.
export const kysQuestions = {
  q1: {
    theme: "Experience",
    text: "How long have you been trading?",
    options: {
      a: "Less than 6 months",
      b: "6 months to 2 years",
      c: "2 to 5 years",
      d: "5+ years",
    },
  },
  q2: {
    theme: "Style & Timeframe",
    text: "What's your typical trade duration on XAU/USD?",
    options: {
      a: "Minutes (in and out same hour)",
      b: "Hours (multiple times per day)",
      c: "A day or two",
      d: "Days to weeks",
      e: "I don't trade gold yet",
    },
  },
  q3: {
    theme: "Your Edge",
    text: "When you enter a trade, what's the actual reason?",
    options: {
      a: "A specific setup from a system I follow",
      b: "A signal someone else gave me",
      c: "Multiple indicators all lining up (RSI + MACD + MAs)",
      d: "A news event or economic release",
      e: "A feeling based on what I see",
      f: "I just want to be in a trade",
    },
  },
  q4: {
    theme: "Risk & Sizing",
    text: "How would you describe your usual position sizing?",
    options: {
      a: "Small and consistent (same % every trade)",
      b: "Varies a little when I'm more confident",
      c: "Sometimes big when I'm sure",
      d: "I size up when I am losing to win it back",
      e: "No real plan",
    },
  },
  q5: {
    theme: "Your Leak",
    text: "Which of these hurts you most?",
    options: {
      a: "Hesitating and missing trades I should have taken",
      b: "Chasing price after the move is already gone",
      c: "Over-trading when there's nothing there",
      d: "Blowing up after a losing streak",
      e: "Switching systems before any of them get a chance to work",
      f: "Indicators contradict each other and I freeze",
      g: "I haven't traded enough to know",
    },
  },
  q6: {
    theme: "Signals",
    text: "How do you use signals from others?",
    options: {
      a: "I trade them blind, that's my whole approach",
      b: "I use them as one input alongside my own analysis",
      c: "I ignore them entirely",
      d: "I don't follow any signal sources",
    },
  },
  q7: {
    theme: "Psychology",
    text: "After a loss, what's most typical for you?",
    options: {
      a: "Calm — I review and move on",
      b: "I want to win it back immediately",
      c: "I step away and come back fine later",
      d: "I avoid trading for days",
      e: "I haven't lost meaningfully yet",
    },
  },
  q8: {
    theme: "Motivation",
    text: "Why are you trading?",
    options: {
      a: "Build a consistent income",
      b: "Supplement what I earn elsewhere",
      c: "Build up for a prop firm",
      d: "Go full-time eventually",
      e: "Curious / exploring",
      f: "Not sure yet",
    },
  },
  q9: {
    theme: "Your Routine",
    text: "Before you place a trade, how often is the plan — entry, stop, target — decided in advance?",
    options: {
      a: "Always — it's written down before I click",
      b: "Usually, at least clear in my head",
      c: "Sometimes — depends on the setup",
      d: "Rarely — I decide as it unfolds",
    },
  },
  q10: {
    theme: "Review & Journaling",
    text: "Do you journal your trades and review them?",
    options: {
      a: "Every trade, reviewed regularly",
      b: "On and off",
      c: "I've tried but don't keep it up",
      d: "No, I don't journal",
    },
  },
  q11: {
    theme: "Commitment",
    text: "You've followed a strategy for 8 trades and you're slightly down. What's your move?",
    options: {
      a: "8 trades tells me nothing — keep going to a real sample",
      b: "Tweak the rules and continue",
      c: "Start looking for a better strategy",
      d: "Stop trading until I feel confident again",
    },
  },
  q12: {
    theme: "Decisiveness",
    text: "A setup you trade appears, but it's only about 80% textbook. What do you do?",
    options: {
      a: "Take it — no setup is ever 100%",
      b: "Take it, but smaller",
      c: "Wait for more confirmation",
      d: "Skip it — I only take perfect setups",
    },
  },
  q13: {
    theme: "Under Pressure",
    text: "Gold spikes 30 pips against you seconds after you enter — your stop is not hit. What actually happens?",
    options: {
      a: "Nothing — my stop is set and I leave it alone",
      b: "I watch it closely, ready to bail out early",
      c: "I move my stop further to give it room",
      d: "I add to the position for a better average",
    },
  },
  q14: {
    theme: "Independence",
    text: "If every signal group and indicator vanished tomorrow, could you find and manage a trade on a bare XAU/USD chart?",
    options: {
      a: "Yes, comfortably — I read structure myself",
      b: "Mostly, but I'd be slower",
      c: "Not really — I lean on my tools and signals",
      d: "No — I wouldn't know where to start",
    },
  },
} as const;
