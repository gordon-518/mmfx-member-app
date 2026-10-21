import archetypesConfig from './archetypes.json';
import type { ArchetypeProfile, ArchetypeId } from './types';

export const ARCHETYPES = archetypesConfig as ArchetypeProfile[];

export function getArchetype(id: ArchetypeId): ArchetypeProfile | undefined {
  return ARCHETYPES.find(a => a.id === id);
}
