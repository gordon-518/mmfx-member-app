import type { Question } from './types';

// Each option carries archetype `scoring` (drives the headline archetype) and
// `dimensions` deltas (signed, higher = healthier; drives the 0–100 profile).
export const QUESTIONS: Question[] = [
  {
    id: 'q1',
    theme: 'Experience',
    text: 'How long have you been trading?',
    options: [
      { id: 'a', text: 'Less than 6 months', scoring: { brand_new_beginner: 3, reckless_gambler: 1 } },
      { id: 'b', text: '6 months to 2 years', scoring: { reckless_gambler: 1, indicator_stacker: 1, system_hopper: 1, emotional_revenge_trader: 1 } },
      { id: 'c', text: '2 to 5 years', scoring: { system_hopper: 1, indicator_stacker: 1, analysis_paralyser: 1, emotional_revenge_trader: 1 } },
      { id: 'd', text: '5+ years', scoring: { analysis_paralyser: 2, news_trader: 1 }, dimensions: { process_routine: 1 } }
    ]
  },
  {
    id: 'q2',
    theme: 'Style & Timeframe',
    text: "What's your typical trade duration on XAU/USD?",
    options: [
      { id: 'a', text: 'Minutes (in and out same hour)', scoring: { emotional_revenge_trader: 2, reckless_gambler: 1 }, dimensions: { emotional_control: -1 } },
      { id: 'b', text: 'Hours (multiple times per day)', scoring: { news_trader: 2, indicator_stacker: 1, emotional_revenge_trader: 1 } },
      { id: 'c', text: 'A day or two', scoring: { indicator_stacker: 2, analysis_paralyser: 1, news_trader: 1 }, dimensions: { process_routine: 1 } },
      { id: 'd', text: 'Days to weeks', scoring: { news_trader: 2, analysis_paralyser: 1 }, dimensions: { process_routine: 1, emotional_control: 1 } },
      { id: 'e', text: "I don't trade gold yet", scoring: { brand_new_beginner: 2 } }
    ]
  },
  {
    id: 'q3',
    theme: 'Your Edge',
    text: "When you enter a trade, what's the actual reason?",
    options: [
      { id: 'a', text: 'A specific setup from a system I follow', scoring: { analysis_paralyser: 2, system_hopper: 2 }, dimensions: { independent_conviction: 2, process_routine: 1 } },
      { id: 'b', text: 'A signal someone else gave me', scoring: { signal_dependent: 3 }, dimensions: { independent_conviction: -3 } },
      { id: 'c', text: 'Multiple indicators all lining up (RSI + MACD + MAs)', scoring: { indicator_stacker: 3, analysis_paralyser: 1 }, dimensions: { independent_conviction: -1, decisiveness: -1 } },
      { id: 'd', text: 'A news event or economic release', scoring: { news_trader: 3 }, dimensions: { independent_conviction: 1 } },
      { id: 'e', text: 'A feeling based on what I see', scoring: { reckless_gambler: 2, emotional_revenge_trader: 1 }, dimensions: { risk_discipline: -1, process_routine: -1 } },
      { id: 'f', text: 'I just want to be in a trade', scoring: { reckless_gambler: 3, emotional_revenge_trader: 1 }, dimensions: { risk_discipline: -2, emotional_control: -1, process_routine: -2 } }
    ]
  },
  {
    id: 'q4',
    theme: 'Risk & Sizing',
    text: 'How would you describe your usual position sizing?',
    options: [
      { id: 'a', text: 'Small and consistent (same % every trade)', scoring: { analysis_paralyser: 2, system_hopper: 1, news_trader: 1 }, dimensions: { risk_discipline: 3, process_routine: 1 } },
      { id: 'b', text: "Varies a little when I'm more confident", scoring: { emotional_revenge_trader: 1, news_trader: 1 }, dimensions: { risk_discipline: 1 } },
      { id: 'c', text: "Sometimes big when I'm sure", scoring: { reckless_gambler: 2, emotional_revenge_trader: 1 }, dimensions: { risk_discipline: -1 } },
      { id: 'd', text: 'I size up when I am losing to win it back', scoring: { emotional_revenge_trader: 3, reckless_gambler: 2 }, dimensions: { risk_discipline: -3, emotional_control: -2 } },
      { id: 'e', text: 'No real plan', scoring: { reckless_gambler: 2, brand_new_beginner: 1, emotional_revenge_trader: 1 }, dimensions: { risk_discipline: -2, process_routine: -2 } }
    ]
  },
  {
    id: 'q5',
    theme: 'Your Leak',
    text: 'Which of these hurts you most?',
    options: [
      { id: 'a', text: 'Hesitating and missing trades I should have taken', scoring: { analysis_paralyser: 3 }, dimensions: { decisiveness: -3 } },
      { id: 'b', text: 'Chasing price after the move is already gone', scoring: { reckless_gambler: 2, emotional_revenge_trader: 1 }, dimensions: { decisiveness: -1, risk_discipline: -1, emotional_control: -1 } },
      { id: 'c', text: "Over-trading when there's nothing there", scoring: { reckless_gambler: 2, emotional_revenge_trader: 1, news_trader: 1 }, dimensions: { process_routine: -1, emotional_control: -1 } },
      { id: 'd', text: 'Blowing up after a losing streak', scoring: { emotional_revenge_trader: 3, reckless_gambler: 1 }, dimensions: { emotional_control: -3, risk_discipline: -1 } },
      { id: 'e', text: 'Switching systems before any of them get a chance to work', scoring: { system_hopper: 4 }, dimensions: { consistency: -3 } },
      { id: 'f', text: 'Indicators contradict each other and I freeze', scoring: { indicator_stacker: 3 }, dimensions: { decisiveness: -2, independent_conviction: -1 } },
      { id: 'g', text: "I haven't traded enough to know", scoring: { brand_new_beginner: 2 } }
    ]
  },
  {
    id: 'q6',
    theme: 'Signals',
    text: 'How do you use signals from others?',
    options: [
      { id: 'a', text: "I trade them blind, that's my whole approach", scoring: { signal_dependent: 3 }, dimensions: { independent_conviction: -3 } },
      { id: 'b', text: 'I use them as one input alongside my own analysis', scoring: { news_trader: 1, analysis_paralyser: 1 }, dimensions: { independent_conviction: 2 } },
      { id: 'c', text: 'I ignore them entirely', scoring: { indicator_stacker: 1, analysis_paralyser: 1, news_trader: 1 }, dimensions: { independent_conviction: 2 } },
      { id: 'd', text: "I don't follow any signal sources", scoring: { brand_new_beginner: 1, indicator_stacker: 1 }, dimensions: { independent_conviction: 1 } }
    ]
  },
  {
    id: 'q7',
    theme: 'Psychology',
    text: "After a loss, what's most typical for you?",
    options: [
      { id: 'a', text: 'Calm — I review and move on', scoring: { analysis_paralyser: 1, news_trader: 1 }, dimensions: { emotional_control: 3, process_routine: 1 } },
      { id: 'b', text: 'I want to win it back immediately', scoring: { emotional_revenge_trader: 3, reckless_gambler: 1 }, dimensions: { emotional_control: -3, risk_discipline: -1 } },
      { id: 'c', text: 'I step away and come back fine later', scoring: { analysis_paralyser: 1 }, dimensions: { emotional_control: 2 } },
      { id: 'd', text: 'I avoid trading for days', scoring: { analysis_paralyser: 2, system_hopper: 1 }, dimensions: { emotional_control: -1, decisiveness: -1 } },
      { id: 'e', text: "I haven't lost meaningfully yet", scoring: { brand_new_beginner: 2 } }
    ]
  },
  {
    id: 'q8',
    theme: 'Motivation',
    text: 'Why are you trading?',
    options: [
      { id: 'a', text: 'Build a consistent income', scoring: {}, dimensions: { process_routine: 1 } },
      { id: 'b', text: 'Supplement what I earn elsewhere', scoring: {} },
      { id: 'c', text: 'Build up for a prop firm', scoring: { analysis_paralyser: 1 }, dimensions: { process_routine: 1 } },
      { id: 'd', text: 'Go full-time eventually', scoring: { indicator_stacker: 1, news_trader: 1 } },
      { id: 'e', text: 'Curious / exploring', scoring: { brand_new_beginner: 2 } },
      { id: 'f', text: 'Not sure yet', scoring: { brand_new_beginner: 2 } }
    ]
  },
  {
    id: 'q9',
    theme: 'Your Routine',
    text: 'Before you place a trade, how often is the plan — entry, stop, target — decided in advance?',
    options: [
      { id: 'a', text: "Always — it's written down before I click", scoring: { analysis_paralyser: 1 }, dimensions: { process_routine: 3, risk_discipline: 2 } },
      { id: 'b', text: 'Usually, at least clear in my head', scoring: {}, dimensions: { process_routine: 1, risk_discipline: 1 } },
      { id: 'c', text: 'Sometimes — depends on the setup', scoring: {}, dimensions: { process_routine: 0 } },
      { id: 'd', text: 'Rarely — I decide as it unfolds', scoring: { reckless_gambler: 1, emotional_revenge_trader: 1 }, dimensions: { process_routine: -2, risk_discipline: -1 } }
    ]
  },
  {
    id: 'q10',
    theme: 'Review & Journaling',
    text: 'Do you journal your trades and review them?',
    options: [
      { id: 'a', text: 'Every trade, reviewed regularly', scoring: { analysis_paralyser: 1 }, dimensions: { process_routine: 3, consistency: 1 } },
      { id: 'b', text: 'On and off', scoring: {}, dimensions: { process_routine: 1 } },
      { id: 'c', text: "I've tried but don't keep it up", scoring: { system_hopper: 1 }, dimensions: { process_routine: -1, consistency: -1 } },
      { id: 'd', text: "No, I don't journal", scoring: { reckless_gambler: 1, brand_new_beginner: 1 }, dimensions: { process_routine: -2 } }
    ]
  },
  {
    id: 'q11',
    theme: 'Commitment',
    text: "You've followed a strategy for 8 trades and you're slightly down. What's your move?",
    options: [
      { id: 'a', text: '8 trades tells me nothing — keep going to a real sample', scoring: { analysis_paralyser: 1 }, dimensions: { consistency: 3, emotional_control: 1 } },
      { id: 'b', text: 'Tweak the rules and continue', scoring: { indicator_stacker: 1 }, dimensions: { consistency: 0 } },
      { id: 'c', text: 'Start looking for a better strategy', scoring: { system_hopper: 3 }, dimensions: { consistency: -3 } },
      { id: 'd', text: 'Stop trading until I feel confident again', scoring: { analysis_paralyser: 1 }, dimensions: { consistency: -1, decisiveness: -2 } }
    ]
  },
  {
    id: 'q12',
    theme: 'Decisiveness',
    text: "A setup you trade appears, but it's only about 80% textbook. What do you do?",
    options: [
      { id: 'a', text: 'Take it — no setup is ever 100%', scoring: { news_trader: 1 }, dimensions: { decisiveness: 3 } },
      { id: 'b', text: 'Take it, but smaller', scoring: {}, dimensions: { decisiveness: 2, risk_discipline: 1 } },
      { id: 'c', text: 'Wait for more confirmation', scoring: { analysis_paralyser: 2 }, dimensions: { decisiveness: -2 } },
      { id: 'd', text: 'Skip it — I only take perfect setups', scoring: { analysis_paralyser: 3 }, dimensions: { decisiveness: -3 } }
    ]
  },
  {
    id: 'q13',
    theme: 'Under Pressure',
    text: 'Gold spikes 30 pips against you seconds after you enter — your stop is not hit. What actually happens?',
    options: [
      { id: 'a', text: 'Nothing — my stop is set and I leave it alone', scoring: { analysis_paralyser: 1 }, dimensions: { risk_discipline: 3, emotional_control: 2 } },
      { id: 'b', text: 'I watch it closely, ready to bail out early', scoring: {}, dimensions: { emotional_control: -1, decisiveness: -1 } },
      { id: 'c', text: 'I move my stop further to give it room', scoring: { emotional_revenge_trader: 2, reckless_gambler: 1 }, dimensions: { risk_discipline: -3, emotional_control: -1 } },
      { id: 'd', text: 'I add to the position for a better average', scoring: { reckless_gambler: 2, emotional_revenge_trader: 1 }, dimensions: { risk_discipline: -3, emotional_control: -2 } }
    ]
  },
  {
    id: 'q14',
    theme: 'Independence',
    text: 'If every signal group and indicator vanished tomorrow, could you find and manage a trade on a bare XAU/USD chart?',
    options: [
      { id: 'a', text: 'Yes, comfortably — I read structure myself', scoring: { analysis_paralyser: 1 }, dimensions: { independent_conviction: 3, process_routine: 1 } },
      { id: 'b', text: "Mostly, but I'd be slower", scoring: {}, dimensions: { independent_conviction: 1 } },
      { id: 'c', text: 'Not really — I lean on my tools and signals', scoring: { indicator_stacker: 1, signal_dependent: 1 }, dimensions: { independent_conviction: -2 } },
      { id: 'd', text: "No — I wouldn't know where to start", scoring: { signal_dependent: 2, brand_new_beginner: 1 }, dimensions: { independent_conviction: -3 } }
    ]
  }
];
