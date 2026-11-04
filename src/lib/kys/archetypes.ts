import archetypesConfig from './archetypes.json';
import type { ArchetypeProfile, ArchetypeId } from './types';
import { en } from '@/i18n/messages/en';
import type { Messages } from '@/i18n/messages/types';

export const ARCHETYPES = archetypesConfig as ArchetypeProfile[];

export function getArchetype(id: ArchetypeId): ArchetypeProfile | undefined {
  return ARCHETYPES.find(a => a.id === id);
}

/**
 * The archetype ID behind a stored value. profiles.kys_archetype holds the ID
 * ("news_trader"), but until Nov 2026 the "Send me a copy" route overwrote it
 * with the English display name ("The News Trader"), and before Know Your
 * Style moved into the app that was the only way it was ever set. Both read
 * back to the same ID; anything else is null.
 */
export function toArchetypeId(value: string | null | undefined): ArchetypeId | null {
  if (!value) return null;
  const v = value.trim();
  const hit = ARCHETYPES.find(a => a.id === v) ?? ARCHETYPES.find(a => a.name.toLowerCase() === v.toLowerCase());
  return hit?.id ?? null;
}

/** The archetype's name in the reader's language, or null for an unknown value. */
export function archetypeName(value: string | null | undefined, words: Messages['archetypes'] = en.archetypes): string | null {
  const id = toArchetypeId(value);
  return id ? words[id].name : null;
}
