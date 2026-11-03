import type { AnswerOption, Question } from './types';
import { en } from '@/i18n/messages/en';
import type { Messages } from '@/i18n/messages/types';

// Each option carries archetype `scoring` (drives the headline archetype) and
// `dimensions` deltas (signed, higher = healthier; drives the 0–100 profile).
//
// The words live in the i18n dictionary (messages/<locale>/kysQuestions.ts);
// this file holds only the structure, so scoring is identical in every
// language and an answer is always stored by option id, never by its text.

type QuestionSpec = Omit<Question, 'text' | 'theme' | 'options'> & {
  options: Omit<AnswerOption, 'text'>[];
};

/** One question's words, as the dictionary holds them. */
interface QuestionWords {
  theme: string;
  text: string;
  options: Record<string, string>;
}

const SPECS: QuestionSpec[] = [
  {
    id: 'q1',
    options: [
      { id: 'a', scoring: { brand_new_beginner: 3, reckless_gambler: 1 } },
      { id: 'b', scoring: { reckless_gambler: 1, indicator_stacker: 1, system_hopper: 1, emotional_revenge_trader: 1 } },
      { id: 'c', scoring: { system_hopper: 1, indicator_stacker: 1, analysis_paralyser: 1, emotional_revenge_trader: 1 } },
      { id: 'd', scoring: { analysis_paralyser: 2, news_trader: 1 }, dimensions: { process_routine: 1 } }
    ]
  },
  {
    id: 'q2',
    options: [
      { id: 'a', scoring: { emotional_revenge_trader: 2, reckless_gambler: 1 }, dimensions: { emotional_control: -1 } },
      { id: 'b', scoring: { news_trader: 2, indicator_stacker: 1, emotional_revenge_trader: 1 } },
      { id: 'c', scoring: { indicator_stacker: 2, analysis_paralyser: 1, news_trader: 1 }, dimensions: { process_routine: 1 } },
      { id: 'd', scoring: { news_trader: 2, analysis_paralyser: 1 }, dimensions: { process_routine: 1, emotional_control: 1 } },
      { id: 'e', scoring: { brand_new_beginner: 2 } }
    ]
  },
  {
    id: 'q3',
    options: [
      { id: 'a', scoring: { analysis_paralyser: 2, system_hopper: 2 }, dimensions: { independent_conviction: 2, process_routine: 1 } },
      { id: 'b', scoring: { signal_dependent: 3 }, dimensions: { independent_conviction: -3 } },
      { id: 'c', scoring: { indicator_stacker: 3, analysis_paralyser: 1 }, dimensions: { independent_conviction: -1, decisiveness: -1 } },
      { id: 'd', scoring: { news_trader: 3 }, dimensions: { independent_conviction: 1 } },
      { id: 'e', scoring: { reckless_gambler: 2, emotional_revenge_trader: 1 }, dimensions: { risk_discipline: -1, process_routine: -1 } },
      { id: 'f', scoring: { reckless_gambler: 3, emotional_revenge_trader: 1 }, dimensions: { risk_discipline: -2, emotional_control: -1, process_routine: -2 } }
    ]
  },
  {
    id: 'q4',
    options: [
      { id: 'a', scoring: { analysis_paralyser: 2, system_hopper: 1, news_trader: 1 }, dimensions: { risk_discipline: 3, process_routine: 1 } },
      { id: 'b', scoring: { emotional_revenge_trader: 1, news_trader: 1 }, dimensions: { risk_discipline: 1 } },
      { id: 'c', scoring: { reckless_gambler: 2, emotional_revenge_trader: 1 }, dimensions: { risk_discipline: -1 } },
      { id: 'd', scoring: { emotional_revenge_trader: 3, reckless_gambler: 2 }, dimensions: { risk_discipline: -3, emotional_control: -2 } },
      { id: 'e', scoring: { reckless_gambler: 2, brand_new_beginner: 1, emotional_revenge_trader: 1 }, dimensions: { risk_discipline: -2, process_routine: -2 } }
    ]
  },
  {
    id: 'q5',
    options: [
      { id: 'a', scoring: { analysis_paralyser: 3 }, dimensions: { decisiveness: -3 } },
      { id: 'b', scoring: { reckless_gambler: 2, emotional_revenge_trader: 1 }, dimensions: { decisiveness: -1, risk_discipline: -1, emotional_control: -1 } },
      { id: 'c', scoring: { reckless_gambler: 2, emotional_revenge_trader: 1, news_trader: 1 }, dimensions: { process_routine: -1, emotional_control: -1 } },
      { id: 'd', scoring: { emotional_revenge_trader: 3, reckless_gambler: 1 }, dimensions: { emotional_control: -3, risk_discipline: -1 } },
      { id: 'e', scoring: { system_hopper: 4 }, dimensions: { consistency: -3 } },
      { id: 'f', scoring: { indicator_stacker: 3 }, dimensions: { decisiveness: -2, independent_conviction: -1 } },
      { id: 'g', scoring: { brand_new_beginner: 2 } }
    ]
  },
  {
    id: 'q6',
    options: [
      { id: 'a', scoring: { signal_dependent: 3 }, dimensions: { independent_conviction: -3 } },
      { id: 'b', scoring: { news_trader: 1, analysis_paralyser: 1 }, dimensions: { independent_conviction: 2 } },
      { id: 'c', scoring: { indicator_stacker: 1, analysis_paralyser: 1, news_trader: 1 }, dimensions: { independent_conviction: 2 } },
      { id: 'd', scoring: { brand_new_beginner: 1, indicator_stacker: 1 }, dimensions: { independent_conviction: 1 } }
    ]
  },
  {
    id: 'q7',
    options: [
      { id: 'a', scoring: { analysis_paralyser: 1, news_trader: 1 }, dimensions: { emotional_control: 3, process_routine: 1 } },
      { id: 'b', scoring: { emotional_revenge_trader: 3, reckless_gambler: 1 }, dimensions: { emotional_control: -3, risk_discipline: -1 } },
      { id: 'c', scoring: { analysis_paralyser: 1 }, dimensions: { emotional_control: 2 } },
      { id: 'd', scoring: { analysis_paralyser: 2, system_hopper: 1 }, dimensions: { emotional_control: -1, decisiveness: -1 } },
      { id: 'e', scoring: { brand_new_beginner: 2 } }
    ]
  },
  {
    id: 'q8',
    options: [
      { id: 'a', scoring: {}, dimensions: { process_routine: 1 } },
      { id: 'b', scoring: {} },
      { id: 'c', scoring: { analysis_paralyser: 1 }, dimensions: { process_routine: 1 } },
      { id: 'd', scoring: { indicator_stacker: 1, news_trader: 1 } },
      { id: 'e', scoring: { brand_new_beginner: 2 } },
      { id: 'f', scoring: { brand_new_beginner: 2 } }
    ]
  },
  {
    id: 'q9',
    options: [
      { id: 'a', scoring: { analysis_paralyser: 1 }, dimensions: { process_routine: 3, risk_discipline: 2 } },
      { id: 'b', scoring: {}, dimensions: { process_routine: 1, risk_discipline: 1 } },
      { id: 'c', scoring: {}, dimensions: { process_routine: 0 } },
      { id: 'd', scoring: { reckless_gambler: 1, emotional_revenge_trader: 1 }, dimensions: { process_routine: -2, risk_discipline: -1 } }
    ]
  },
  {
    id: 'q10',
    options: [
      { id: 'a', scoring: { analysis_paralyser: 1 }, dimensions: { process_routine: 3, consistency: 1 } },
      { id: 'b', scoring: {}, dimensions: { process_routine: 1 } },
      { id: 'c', scoring: { system_hopper: 1 }, dimensions: { process_routine: -1, consistency: -1 } },
      { id: 'd', scoring: { reckless_gambler: 1, brand_new_beginner: 1 }, dimensions: { process_routine: -2 } }
    ]
  },
  {
    id: 'q11',
    options: [
      { id: 'a', scoring: { analysis_paralyser: 1 }, dimensions: { consistency: 3, emotional_control: 1 } },
      { id: 'b', scoring: { indicator_stacker: 1 }, dimensions: { consistency: 0 } },
      { id: 'c', scoring: { system_hopper: 3 }, dimensions: { consistency: -3 } },
      { id: 'd', scoring: { analysis_paralyser: 1 }, dimensions: { consistency: -1, decisiveness: -2 } }
    ]
  },
  {
    id: 'q12',
    options: [
      { id: 'a', scoring: { news_trader: 1 }, dimensions: { decisiveness: 3 } },
      { id: 'b', scoring: {}, dimensions: { decisiveness: 2, risk_discipline: 1 } },
      { id: 'c', scoring: { analysis_paralyser: 2 }, dimensions: { decisiveness: -2 } },
      { id: 'd', scoring: { analysis_paralyser: 3 }, dimensions: { decisiveness: -3 } }
    ]
  },
  {
    id: 'q13',
    options: [
      { id: 'a', scoring: { analysis_paralyser: 1 }, dimensions: { risk_discipline: 3, emotional_control: 2 } },
      { id: 'b', scoring: {}, dimensions: { emotional_control: -1, decisiveness: -1 } },
      { id: 'c', scoring: { emotional_revenge_trader: 2, reckless_gambler: 1 }, dimensions: { risk_discipline: -3, emotional_control: -1 } },
      { id: 'd', scoring: { reckless_gambler: 2, emotional_revenge_trader: 1 }, dimensions: { risk_discipline: -3, emotional_control: -2 } }
    ]
  },
  {
    id: 'q14',
    options: [
      { id: 'a', scoring: { analysis_paralyser: 1 }, dimensions: { independent_conviction: 3, process_routine: 1 } },
      { id: 'b', scoring: {}, dimensions: { independent_conviction: 1 } },
      { id: 'c', scoring: { indicator_stacker: 1, signal_dependent: 1 }, dimensions: { independent_conviction: -2 } },
      { id: 'd', scoring: { signal_dependent: 2, brand_new_beginner: 1 }, dimensions: { independent_conviction: -3 } }
    ]
  }
];

/** The questions with their words in the reader's language. */
export function questionsIn(words: Messages['kysQuestions'] = en.kysQuestions): Question[] {
  return SPECS.map((spec) => {
    const w = (words as Record<string, QuestionWords>)[spec.id];
    return {
      ...spec,
      theme: w.theme,
      text: w.text,
      options: spec.options.map((o) => ({ ...o, text: w.options[o.id] }))
    };
  });
}

/** The questions in English: what scoring, validation and the report prompt read. */
export const QUESTIONS: Question[] = questionsIn();
