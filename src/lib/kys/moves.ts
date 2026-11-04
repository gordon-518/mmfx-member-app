import type { ArchetypeId, ArchetypeProfile, DimensionScores, Move } from './types';
import archetypesConfig from './archetypes.json';
import { weakestDimensions } from './dimensions';
import { DIMENSION_ROUTES } from './routing';
import { en } from '@/i18n/messages/en';
import type { Messages } from '@/i18n/messages/types';

/** The dictionary parts a move's words come from. */
type MoveWords = Pick<Messages, 'kys' | 'archetypes'>;

/**
 * Choose the 2–3 "next move" buttons for a report:
 *   1. Primary = the archetype's keystone.
 *   2. One button per the trader's two weakest dimensions, each the first
 *      destination for that dimension not already used (dedupe by path).
 * Capped at 3 buttons. Labels are in the reader's language (English by default).
 */
export function selectMoves(archetype: ArchetypeId, scores: DimensionScores, t: MoveWords = en): Move[] {
  const profile = (archetypesConfig as ArchetypeProfile[]).find(a => a.id === archetype);
  const moves: Move[] = [];
  const usedPaths = new Set<string>();

  if (profile?.keystone) {
    const words = t.archetypes[archetype];
    moves.push({ path: profile.keystone.path, label: words.keystoneLabel, why: words.keystoneWhy, primary: true });
    usedPaths.add(profile.keystone.path);
  }

  for (const dimId of weakestDimensions(scores, 2)) {
    if (moves.length >= 3) break;
    const options = DIMENSION_ROUTES[dimId] ?? [];
    const pick = options.find(o => !usedPaths.has(o.path));
    if (pick) {
      const words = t.kys.moves[pick.key];
      moves.push({ path: pick.path, label: words.label, why: words.why, primary: false });
      usedPaths.add(pick.path);
    }
  }

  return moves.slice(0, 3);
}
