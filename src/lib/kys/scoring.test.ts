import { describe, it, expect } from 'vitest';
import { scoreAnswers } from './scoring';
import personas from './mock-personas.json';
import type { UserAnswers, ArchetypeId } from './types';

interface Persona {
  label: string;
  answers: UserAnswers;
  expected: ArchetypeId;
}

describe('scoring', () => {
  for (const persona of personas as Persona[]) {
    it(`routes ${persona.label} to ${persona.expected}`, () => {
      const result = scoreAnswers(persona.answers);
      expect(result).toBe(persona.expected);
    });
  }
});
