import { describe, it, expect } from 'vitest';
import { QUESTIONS, questionsIn } from './questions';
import { DIMENSIONS, dimensionsIn } from './dimensions';
import { ARCHETYPES, archetypeName, toArchetypeId } from './archetypes';
import { selectMoves } from './moves';
import { DIMENSION_ROUTES, ROUTES } from './routing';
import { scoreAnswers } from './scoring';
import personas from './mock-personas.json';
import type { ArchetypeId, DimensionScores, UserAnswers } from './types';
import { LOCALES } from '@/i18n/config';
import { MESSAGES } from '@/i18n/messages';
import { MONEY_CLAIM, leaves } from '@/i18n/moneyClaims';

const SCORES: DimensionScores = {
  risk_discipline: 30,
  emotional_control: 20,
  independent_conviction: 75,
  decisiveness: 65,
  consistency: 55,
  process_routine: 45
};

describe('the questions in every language', () => {
  it('has every question and option, with words, in every language', () => {
    for (const locale of LOCALES) {
      const qs = questionsIn(MESSAGES[locale].kysQuestions);
      expect(qs.map(q => q.id), locale).toEqual(QUESTIONS.map(q => q.id));
      for (const [i, q] of qs.entries()) {
        expect(q.text, `${locale}/${q.id}`).toBeTruthy();
        expect(q.theme, `${locale}/${q.id}`).toBeTruthy();
        expect(q.options.map(o => o.id)).toEqual(QUESTIONS[i].options.map(o => o.id));
        for (const o of q.options) expect(o.text, `${locale}/${q.id}/${o.id}`).toBeTruthy();
      }
    }
  });

  it('scores the same in every language: only the words differ', () => {
    const strip = (qs: typeof QUESTIONS) =>
      qs.map(q => q.options.map(o => ({ id: o.id, scoring: o.scoring, dimensions: o.dimensions })));
    for (const locale of LOCALES) {
      expect(strip(questionsIn(MESSAGES[locale].kysQuestions)), locale).toEqual(strip(QUESTIONS));
    }
    // Answers are ids, so a persona lands on the same archetype whatever the language.
    for (const p of personas as { answers: UserAnswers; expected: ArchetypeId }[]) {
      expect(scoreAnswers(p.answers)).toBe(p.expected);
    }
  });
});

describe('dimensions', () => {
  it('reads its English names from the dictionary', () => {
    expect(DIMENSIONS.map(d => d.name)).toEqual(Object.values(MESSAGES.en.dimensions).map(d => d.name));
    expect(dimensionsIn(MESSAGES['zh-Hans'].dimensions)[0]).toMatchObject({ id: 'risk_discipline', name: '风险纪律' });
  });
});

describe('archetypes', () => {
  it('keeps the English dictionary in step with archetypes.json (the report prompt reads the JSON)', () => {
    for (const a of ARCHETYPES) {
      const words = MESSAGES.en.archetypes[a.id];
      expect(words.name).toBe(a.name);
      expect(words.keystoneLabel).toBe(a.keystone.label);
      expect(words.keystoneWhy).toBe(a.keystone.why);
    }
  });

  it('has every archetype named in every language', () => {
    for (const locale of LOCALES) {
      for (const a of ARCHETYPES) {
        const words = MESSAGES[locale].archetypes[a.id];
        expect(words.name && words.keystoneLabel && words.keystoneWhy, `${locale}/${a.id}`).toBeTruthy();
      }
    }
  });

  it('reads an ID or a legacy English display name back to the ID', () => {
    expect(toArchetypeId('news_trader')).toBe('news_trader');
    expect(toArchetypeId('The News Trader')).toBe('news_trader');
    expect(toArchetypeId(' the news trader ')).toBe('news_trader');
    expect(toArchetypeId('The Sniper')).toBeNull();
    expect(toArchetypeId('')).toBeNull();
    expect(toArchetypeId(null)).toBeNull();
  });

  it('names an archetype in the reader’s language, whichever way it was stored', () => {
    expect(archetypeName('news_trader')).toBe('The News Trader');
    expect(archetypeName('The News Trader', MESSAGES['zh-Hans'].archetypes)).toBe('新闻交易者');
    expect(archetypeName('unknown')).toBeNull();
  });
});

describe('next moves', () => {
  it('go to the same places in every language, with the words translated', () => {
    const english = selectMoves('emotional_revenge_trader', SCORES);
    for (const locale of LOCALES) {
      const moves = selectMoves('emotional_revenge_trader', SCORES, MESSAGES[locale]);
      expect(moves.map(m => [m.path, m.primary]), locale).toEqual(english.map(m => [m.path, m.primary]));
      expect(moves.every(m => m.label && m.why), locale).toBe(true);
    }
    expect(selectMoves('emotional_revenge_trader', SCORES, MESSAGES['zh-Hans'])[0].label).toBe('阅读 If-Then 电子书');
  });

  it('every dimension move has words, and every route a sidebar name', () => {
    for (const locale of LOCALES) {
      for (const routes of Object.values(DIMENSION_ROUTES)) {
        for (const r of routes) expect(MESSAGES[locale].kys.moves[r.key].label, `${locale}/${r.key}`).toBeTruthy();
      }
      for (const r of Object.values(ROUTES)) expect(MESSAGES[locale].nav[r.navKey], `${locale}/${r.path}`).toBeTruthy();
    }
  });
});

describe('copy compliance', () => {
  // Scanned: everything the bots say to the member. Not scanned, on purpose:
  // kysQuestions (the answers are the trader's own words about themselves,
  // e.g. "Build a consistent income") and kysReport (the risk footer has to
  // say "risk of loss").
  it('the bots promise no profit or returns, in any language', () => {
    for (const locale of LOCALES) {
      const t = MESSAGES[locale];
      const offending = leaves({ kys: t.kys, archetypes: t.archetypes, fundamental: t.fundamental }).filter(([, s]) =>
        MONEY_CLAIM[locale].test(s)
      );
      expect(offending, locale).toEqual([]);
    }
  });
});
