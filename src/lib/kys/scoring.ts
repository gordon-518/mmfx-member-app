import type { ArchetypeId, UserAnswers } from './types';
import { QUESTIONS } from './questions';

export function scoreAnswers(answers: UserAnswers): ArchetypeId {
  if (answers.q1 === 'a' && answers.q5 === 'g' && answers.q7 === 'e') {
    return 'brand_new_beginner';
  }

  const scores: Record<ArchetypeId, number> = {
    reckless_gambler: 0,
    analysis_paralyser: 0,
    signal_dependent: 0,
    indicator_stacker: 0,
    emotional_revenge_trader: 0,
    news_trader: 0,
    system_hopper: 0,
    brand_new_beginner: 0
  };

  for (const question of QUESTIONS) {
    const userAnswerId = answers[question.id];
    if (!userAnswerId) continue;
    const option = question.options.find(o => o.id === userAnswerId);
    if (!option) continue;
    for (const [archetypeId, points] of Object.entries(option.scoring)) {
      scores[archetypeId as ArchetypeId] += points as number;
    }
  }

  let winners: ArchetypeId[] = [];
  let topScore = -1;
  for (const [id, score] of Object.entries(scores) as [ArchetypeId, number][]) {
    if (score > topScore) {
      topScore = score;
      winners = [id];
    } else if (score === topScore) {
      winners.push(id);
    }
  }

  if (winners.length > 1) {
    const q5 = QUESTIONS.find(q => q.id === 'q5')!;
    const q5Option = q5.options.find(o => o.id === answers.q5);
    if (q5Option) {
      const q5Boost = q5Option.scoring;
      let bestWinner = winners[0];
      let bestBoost = q5Boost[bestWinner] ?? 0;
      for (const winner of winners.slice(1)) {
        const boost = q5Boost[winner] ?? 0;
        if (boost > bestBoost) {
          bestBoost = boost;
          bestWinner = winner;
        }
      }
      return bestWinner;
    }
    return winners[0];
  }

  return winners[0];
}
