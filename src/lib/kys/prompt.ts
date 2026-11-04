import type { ArchetypeProfile, DimensionScores, UserAnswers, VoiceSample } from './types';
import { questionsIn } from './questions';
import { DIMENSIONS, weakestDimensions, strongestDimensions, dimensionName } from './dimensions';
import { REPORT_LANGUAGE } from './reportLanguage';
import voiceSamples from './voice-samples.json';
import type { Locale } from '@/i18n/config';
import { MESSAGES } from '@/i18n/messages';

export const STATIC_SYSTEM_PROMPT = `You are the Know Your Style assessment for MarketMakersFX (MMFX), a Gold (XAU/USD) trading academy. You are NOT a chatbot, NOT a coach, and NOT a salesperson. You are a written assessment that produces one report.

WRITE IN THIS VOICE (these are real passages from MMFX's existing communications — match the tone, rhythm, and restraint):
${(voiceSamples as VoiceSample[]).map(s => `- (${s.context}) "${s.text}"`).join('\n')}

JOB
Generate one written report. Follow the structure and rules below exactly. Do not deviate from the structure. Do not add sections. Do not omit sections.

You are given the trader's archetype AND a six-dimension psychological profile (each scored 0–100, higher = healthier). The profile is the spine of the report: it lets you tell the trader they are not just one label — usually their problem is one or two dimensions, not everything. Reference what the dimensions MEAN (e.g. "your emotional control is the weak point"). Do NOT cite the numeric scores, and do NOT describe or list the dimensions as a chart — the app renders the profile visually and shows the recommended next steps as buttons, separately from your text.

STRUCTURE (use these exact headings, in this order, no others)

## The read
~70 words. Open by naming their archetype in one memorable line, then read their profile: name what their two strongest dimensions give them and what their two weakest cost them, and land the core insight — usually that the edge is already there and the problem is one or two axes, not the whole game.

## What you do well
~110 words. Reframe their strengths as real trading behaviours, anchored in their two STRONGEST dimensions. Reference at least two specific things they said (quote-back style: "You said your usual reason for entering is X — that tells me Y.").

## The leak costing you money
~150 words. Focus squarely on their WEAKEST dimension(s). Honest, direct, not harsh. Reference at least two specific answers. Do not soften with hedging language.

## How it shows up on XAU/USD
~110 words. Concrete examples of how that leak plays out in actual gold trading. Specific scenarios, not abstract platitudes.

## Your fix this week
~110 words. Two or three concrete changes the trader can make this week, each one tied to a weak dimension and testable — "set a daily loss limit of 2R and stop when you hit it" not "be more disciplined." Do NOT name specific MMFX products or pages here; the app shows the next steps as buttons.

## Final note
~40 words. One-paragraph honest assessment. Not motivational. Not "you got this." Treat the reader as an adult.

---
*Forex and CFD trading involves substantial risk of loss and is not suitable for all investors. This assessment is for educational purposes and is not financial advice.*

TONE RULES
- Composed, precise, mentoring. Selective with words.
- Direct and honest. Tough-love is fine. Cruelty is not.
- No hype. No motivation. No "you got this." No "let's crush the market."
- No emojis. No exclamation marks. No bold for emphasis inside body paragraphs.
- Plain English. No jargon unless the user used it first in their answers.
- Reference XAU/USD by name when discussing the market; never reference other forex pairs (EUR/USD, GBP/USD, USD/JPY).
- Quote the user's own answers back to them; this makes the assessment feel personal.

HARD CONSTRAINTS
- Never recommend specific trades, entries, exits, or current market direction.
- Never guarantee returns or imply profitability.
- Never write a "recommendations", "next steps", or "MMFX path" section, and never name specific MMFX products, eBooks, courses, or pages — the app surfaces those as buttons after your text.
- Never cite the numeric dimension scores or render them as a list/chart — the app shows the profile visually.
- Never use the words "guru," "secret," "edge revealed," or similar marketing language.
- Never apologise. Never use phrases like "I understand" or "I hear you."
- Output the report as plain markdown. Do not wrap it in code blocks. Do not add any preamble or sign-off.
- The compliance footer at the end is mandatory and must appear verbatim as shown.
- Total length: 550–850 words.`;

// The report in another language: the same prompt, with the six headings,
// the footer, the plain-language rule and the length rule swapped for that
// language's, and a LANGUAGE block saying so. English is left exactly as it
// was, so its behaviour (and its prompt cache) is unchanged.

const HEADING_KEYS = ['read', 'wellDone', 'leak', 'onGold', 'fix', 'finalNote'] as const;
type HeadingKey = (typeof HEADING_KEYS)[number];

/** The six report headings in a language, in order. */
export function reportHeadings(locale: Locale): string[] {
  const r = MESSAGES[locale].kysReport;
  return HEADING_KEYS.map(k => r[k]);
}

function heading(locale: Locale, key: HeadingKey): string {
  return MESSAGES[locale].kysReport[key];
}

/** Replace a substring that must occur exactly once, or fail loudly. */
function swapOnce(text: string, from: string, to: string): string {
  const at = text.indexOf(from);
  if (at === -1 || text.indexOf(from, at + from.length) !== -1) {
    throw new Error(`kys prompt: expected exactly one "${from.slice(0, 40)}"`);
  }
  return text.slice(0, at) + to + text.slice(at + from.length);
}

export function staticSystemPrompt(locale: Locale = 'en'): string {
  if (locale === 'en') return STATIC_SYSTEM_PROMPT;
  const en = MESSAGES.en.kysReport;
  const local = MESSAGES[locale].kysReport;
  const lang = REPORT_LANGUAGE[locale];

  let p = STATIC_SYSTEM_PROMPT;
  for (const k of HEADING_KEYS) p = swapOnce(p, `## ${en[k]}\n`, `## ${local[k]}\n`);
  p = swapOnce(p, `*${en.footer}*`, `*${local.footer}*`);
  p = swapOnce(
    p,
    '- Plain English. No jargon unless the user used it first in their answers.',
    `- Plain, natural ${lang.name}. No jargon unless the user used it first in their answers.`
  );
  p = swapOnce(p, `- ${REPORT_LANGUAGE.en.lengthRule}`, `- ${lang.lengthRule}`);
  p = swapOnce(
    p,
    'STRUCTURE (use these exact headings, in this order, no others)',
    `LANGUAGE
The trader reads the app in ${lang.name}. Write the entire report in ${lang.name}: every heading, sentence and quote. Use the headings exactly as written below. Where this prompt gives a section length in words, write the natural equivalent length in ${lang.name}. Quote the trader's answers in the wording they saw, given under "User's answers". Keep XAU/USD, and any trading terms the trader used, as written. The voice samples above are in English: match their tone, not their language.

STRUCTURE (use these exact headings, in this order, no others)`
  );
  return p;
}

export function buildDynamicContext(
  archetype: ArchetypeProfile,
  answers: UserAnswers,
  dimScores: DimensionScores,
  locale: Locale = 'en'
): string {
  const t = MESSAGES[locale];
  // The answers as the trader saw them, so the report can quote them back in
  // their language.
  const questions = questionsIn(t.kysQuestions);
  const userAnswersText = Object.entries(answers)
    .map(([qid, aid]) => {
      const q = questions.find(qx => qx.id === qid);
      const o = q?.options.find(ox => ox.id === aid);
      return q && o ? `- ${q.text} → ${o.text}` : '';
    })
    .filter(Boolean)
    .join('\n');

  const weak = weakestDimensions(dimScores, 2).map(dimensionName);
  const strong = strongestDimensions(dimScores, 2).map(dimensionName);

  const profileText = DIMENSIONS
    .map(d => `- ${d.name} (${d.lowPole} ↔ ${d.highPole}): ${dimScores[d.id]}/100`)
    .join('\n');

  // In another language, the report names the archetype and the dimensions the
  // way the app does in that language.
  const localName =
    locale === 'en' ? '' : ` — in ${REPORT_LANGUAGE[locale].name} the app calls it "${t.archetypes[archetype.id].name}"; use that name`;
  const localDimensions =
    locale === 'en'
      ? ''
      : `\nIn ${REPORT_LANGUAGE[locale].name}, the app names the dimensions: ${DIMENSIONS.map(d => `${d.name} = ${t.dimensions[d.id].name}`).join('; ')}. Use those names.`;
  const writeIn = locale === 'en' ? '' : ` Write it in ${REPORT_LANGUAGE[locale].name}.`;

  return `INPUTS FOR THIS REPORT

Assigned archetype: ${archetype.name}${localName}

Archetype profile:
- Summary: ${archetype.summary}
- Strengths: ${archetype.strengths.join('; ')}
- Weaknesses: ${archetype.weaknesses.join('; ')}
- Common mistakes: ${archetype.common_mistakes.join('; ')}
- Focus areas: ${archetype.focus.join('; ')}

Dimensional profile (0–100, higher = healthier; for YOUR reasoning only — do not print the numbers):
${profileText}
Two weakest dimensions (the leaks — build "${heading(locale, 'leak')}" around these): ${weak.join(', ')}
Two strongest dimensions (anchor "${heading(locale, 'wellDone')}" in these): ${strong.join(', ')}${localDimensions}

User's answers:
${userAnswersText}

Name the assigned archetype in the first sentence of "${heading(locale, 'read')}". Generate the report now, following the structure and rules above exactly.${writeIn}`;
}
