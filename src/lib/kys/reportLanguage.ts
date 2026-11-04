import type { Locale } from '@/i18n/config';

// What changes about the written report from one language to the next: how the
// prompt names the language, how long a report in it runs, and how much room
// the model needs to write it. The headings and the footer are translations, so
// they live in the dictionary (messages/<locale>/kysReport.ts).

export interface ReportLanguage {
  /** The language as the prompt names it to the model. */
  name: string;
  /** The total-length rule the prompt gives. */
  lengthRule: string;
  /** How the validator counts length: words, or (Chinese) characters. */
  unit: 'words' | 'chars';
  /** The validator's bounds, in `unit`s. Wider than the prompt's rule on purpose. */
  min: number;
  max: number;
  /**
   * max_tokens for the writer. The same report takes more tokens in Chinese,
   * Malay or Indonesian than in English, and a report cut off mid-sentence
   * fails validation, so they get more room. English keeps its original 1500.
   */
  maxTokens: number;
}

const CHINESE_LENGTH = 'Total length: about 1,000–1,600 Chinese characters.';

export const REPORT_LANGUAGE: Record<Locale, ReportLanguage> = {
  en: { name: 'English', lengthRule: 'Total length: 550–850 words.', unit: 'words', min: 500, max: 1100, maxTokens: 1500 },
  'zh-Hans': { name: 'Simplified Chinese (简体中文)', lengthRule: CHINESE_LENGTH, unit: 'chars', min: 700, max: 3000, maxTokens: 3500 },
  'zh-Hant': { name: 'Traditional Chinese (繁體中文)', lengthRule: CHINESE_LENGTH, unit: 'chars', min: 700, max: 3000, maxTokens: 3500 },
  ms: { name: 'Malay (Bahasa Melayu, as written in Malaysia)', lengthRule: 'Total length: 550–950 words.', unit: 'words', min: 450, max: 1400, maxTokens: 3000 },
  id: { name: 'Indonesian (Bahasa Indonesia)', lengthRule: 'Total length: 550–950 words.', unit: 'words', min: 450, max: 1400, maxTokens: 3000 }
};

/**
 * A report's length in its language's unit. Chinese doesn't put spaces between
 * words, so it counts Han characters, plus any Latin-script words ("XAU/USD")
 * in the text.
 */
export function reportLength(text: string, unit: ReportLanguage['unit']): number {
  if (unit === 'words') return text.split(/\s+/).filter(Boolean).length;
  const han = text.match(/\p{Script=Han}/gu)?.length ?? 0;
  const latin = text
    .replace(/\p{Script=Han}/gu, ' ')
    .split(/\s+/)
    .filter(w => /[A-Za-z0-9]/.test(w)).length;
  return han + latin;
}
