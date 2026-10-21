import { describe, it, expect } from 'vitest';
import { scoreDimensions, weakestDimensions, strongestDimensions, DIMENSIONS } from './dimensions';
import { selectMoves } from './moves';
import { validateReport } from './validation';
import type { DimensionScores, UserAnswers } from './types';

const HEALTHY: UserAnswers = {
  q3: 'a', q4: 'a', q6: 'b', q7: 'a', q9: 'a', q10: 'a', q11: 'a', q12: 'a', q13: 'a', q14: 'a'
};
const UNHEALTHY: UserAnswers = {
  q3: 'f', q4: 'd', q5: 'd', q7: 'b', q9: 'd', q10: 'd', q12: 'd', q13: 'd', q14: 'd'
};

describe('scoreDimensions', () => {
  it('returns all six dimensions within 0–100', () => {
    const s = scoreDimensions(HEALTHY);
    expect(Object.keys(s).sort()).toEqual(DIMENSIONS.map(d => d.id).sort());
    for (const v of Object.values(s)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('scores healthy answers high and unhealthy answers low on risk & emotion', () => {
    const healthy = scoreDimensions(HEALTHY);
    const unhealthy = scoreDimensions(UNHEALTHY);
    expect(healthy.risk_discipline).toBeGreaterThan(unhealthy.risk_discipline);
    expect(healthy.emotional_control).toBeGreaterThan(unhealthy.emotional_control);
    expect(healthy.risk_discipline).toBeGreaterThanOrEqual(60);
    expect(unhealthy.risk_discipline).toBeLessThanOrEqual(40);
  });

  it('is deterministic and in-range for sparse input', () => {
    const a = scoreDimensions({});
    const b = scoreDimensions({});
    expect(a).toEqual(b);
    for (const v of Object.values(a)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe('rank helpers', () => {
  it('orders weakest and strongest correctly', () => {
    const scores: DimensionScores = {
      risk_discipline: 30,
      emotional_control: 20,
      independent_conviction: 75,
      decisiveness: 65,
      consistency: 55,
      process_routine: 45
    };
    expect(weakestDimensions(scores, 2)).toEqual(['emotional_control', 'risk_discipline']);
    expect(strongestDimensions(scores, 2)).toEqual(['decisiveness', 'independent_conviction']);
  });
});

describe('selectMoves', () => {
  const scores: DimensionScores = {
    risk_discipline: 30,
    emotional_control: 20,
    independent_conviction: 75,
    decisiveness: 65,
    consistency: 55,
    process_routine: 45
  };

  it('leads with the archetype keystone, dedupes paths, caps at 3', () => {
    const moves = selectMoves('emotional_revenge_trader', scores);
    expect(moves.length).toBeGreaterThanOrEqual(2);
    expect(moves.length).toBeLessThanOrEqual(3);
    expect(moves[0].primary).toBe(true);
    expect(moves[0].path).toBe('/library');
    expect(moves.slice(1).every(m => !m.primary)).toBe(true);
    const paths = moves.map(m => m.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('produces a valid primary for every archetype', () => {
    const archetypes = [
      'reckless_gambler', 'analysis_paralyser', 'signal_dependent', 'indicator_stacker',
      'emotional_revenge_trader', 'news_trader', 'system_hopper', 'brand_new_beginner'
    ] as const;
    for (const a of archetypes) {
      const moves = selectMoves(a, scores);
      expect(moves[0]?.primary).toBe(true);
      expect(typeof moves[0]?.path).toBe('string');
    }
  });
});

describe('validateReport (v2 headings)', () => {
  const footer = 'Forex and CFD trading involves substantial risk of loss and is not suitable for all investors. This assessment is for educational purposes and is not financial advice.';
  const filler = 'This is body text that pads the report to a realistic length so the word count gate passes cleanly. '.repeat(6);
  const good = [
    `## The read\n${filler}`,
    `## What you do well\n${filler}`,
    `## The leak costing you money\n${filler}`,
    `## How it shows up on XAU/USD\n${filler}`,
    `## Your fix this week\n${filler}`,
    `## Final note\n${filler}`,
    `---\n*${footer}*`
  ].join('\n\n');

  it('accepts a well-formed v2 report', () => {
    expect(validateReport(good).ok).toBe(true);
  });

  it('rejects a report missing the footer', () => {
    expect(validateReport(good.replace(footer, 'no footer here')).ok).toBe(false);
  });

  it('rejects a report missing a required heading', () => {
    expect(validateReport(good.replace('## The leak costing you money', '## Random')).ok).toBe(false);
  });
});
