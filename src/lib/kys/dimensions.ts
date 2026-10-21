import type { Dimension, DimensionId, DimensionScores, UserAnswers } from './types';
import { QUESTIONS } from './questions';

/**
 * The six trader-psychology spectra. All oriented "higher = healthier", so a
 * profile reads as a shape and the lowest scores are the leaks.
 */
export const DIMENSIONS: Dimension[] = [
  { id: 'risk_discipline', name: 'Risk Discipline', lowPole: 'Reckless', highPole: 'Disciplined' },
  { id: 'emotional_control', name: 'Emotional Control', lowPole: 'Tilt-prone', highPole: 'Composed' },
  { id: 'independent_conviction', name: 'Independent Conviction', lowPole: 'Dependent', highPole: 'Independent' },
  { id: 'decisiveness', name: 'Decisiveness', lowPole: 'Hesitant', highPole: 'Decisive' },
  { id: 'consistency', name: 'Consistency', lowPole: 'System-hopper', highPole: 'Committed' },
  { id: 'process_routine', name: 'Process & Routine', lowPole: 'Wings it', highPole: 'Routine-driven' }
];

const DIMENSION_IDS = DIMENSIONS.map(d => d.id);

/**
 * Theoretical min/max raw total per dimension, derived from the question set:
 * for each question, the smallest/largest delta available across its options.
 * A trader picks one option per question, so their raw total always lands
 * within [min, max] and normalizes cleanly to 0–100.
 */
function computeBounds(): Record<DimensionId, { min: number; max: number }> {
  const bounds = Object.fromEntries(
    DIMENSION_IDS.map(id => [id, { min: 0, max: 0 }])
  ) as Record<DimensionId, { min: number; max: number }>;

  for (const q of QUESTIONS) {
    for (const id of DIMENSION_IDS) {
      const deltas = q.options.map(o => o.dimensions?.[id] ?? 0);
      bounds[id].min += Math.min(...deltas);
      bounds[id].max += Math.max(...deltas);
    }
  }
  return bounds;
}

const BOUNDS = computeBounds();

/**
 * Deterministically score a set of answers across the six dimensions.
 * Sums each chosen option's deltas, then normalizes each dimension to 0–100
 * against the question set's achievable range. Dimensions with no signal
 * default to 50 (neutral).
 */
export function scoreDimensions(answers: UserAnswers): DimensionScores {
  const raw = Object.fromEntries(DIMENSION_IDS.map(id => [id, 0])) as Record<DimensionId, number>;

  for (const q of QUESTIONS) {
    const chosenId = answers[q.id];
    if (!chosenId) continue;
    const option = q.options.find(o => o.id === chosenId);
    if (!option?.dimensions) continue;
    for (const id of DIMENSION_IDS) {
      raw[id] += option.dimensions[id] ?? 0;
    }
  }

  const scores = {} as DimensionScores;
  for (const id of DIMENSION_IDS) {
    const { min, max } = BOUNDS[id];
    if (max === min) {
      scores[id] = 50;
      continue;
    }
    const pct = ((raw[id] - min) / (max - min)) * 100;
    scores[id] = Math.max(0, Math.min(100, Math.round(pct)));
  }
  return scores;
}

export interface RankedDimension {
  id: DimensionId;
  score: number;
}

/** Dimensions sorted weakest-first. Ties break by the canonical DIMENSIONS order. */
export function rankDimensions(scores: DimensionScores): RankedDimension[] {
  return DIMENSION_IDS
    .map(id => ({ id, score: scores[id] }))
    .sort((a, b) => a.score - b.score || DIMENSION_IDS.indexOf(a.id) - DIMENSION_IDS.indexOf(b.id));
}

/** The N weakest dimension ids (the leaks). */
export function weakestDimensions(scores: DimensionScores, n = 2): DimensionId[] {
  return rankDimensions(scores).slice(0, n).map(d => d.id);
}

/** The N strongest dimension ids. */
export function strongestDimensions(scores: DimensionScores, n = 2): DimensionId[] {
  return rankDimensions(scores).slice(-n).map(d => d.id);
}

export function dimensionName(id: DimensionId): string {
  return DIMENSIONS.find(d => d.id === id)?.name ?? id;
}
