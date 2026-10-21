import { describe, it, expect } from 'vitest';
import { buildResultEmailHtml } from './resultEmail';
import { DIMENSIONS } from './dimensions';
import type { DimensionScores } from './types';

const scores: DimensionScores = {
  risk_discipline: 10,
  emotional_control: 22,
  independent_conviction: 90,
  decisiveness: 64,
  consistency: 55,
  process_routine: 41
};

const markdown = [
  '## The read',
  'You are the **Revenge Trader**. Fix one axis and you are done.',
  '',
  '## Your fix this week',
  '- Set a hard daily loss limit.',
  '- Take a break after two losses.',
  '',
  '---',
  '*Forex and CFD trading involves substantial risk of loss.*'
].join('\n');

describe('buildResultEmailHtml', () => {
  const html = buildResultEmailHtml({ archetypeName: 'The Emotional Revenge Trader', dimensions: scores, markdown });

  it('includes the archetype name and brand header', () => {
    expect(html).toContain('The Emotional Revenge Trader');
    expect(html).toContain('Know Your Style');
  });

  it('renders all six dimensions with their scores', () => {
    for (const d of DIMENSIONS) expect(html).toContain(d.name.replace(/&/g, '&amp;'));
    expect(html).toContain('10 / 100');
    expect(html).toContain('90 / 100');
  });

  it('converts markdown headings, bold, and lists', () => {
    expect(html).toContain('>The read<');
    expect(html).toContain('<strong');
    expect(html).toContain('Revenge Trader');
    expect(html).toContain('<li');
    expect(html).toContain('Set a hard daily loss limit.');
    expect(html).toContain('substantial risk of loss');
  });

  it('is email-safe: table-based, inline-styled, no script/flex/grid', () => {
    expect(html).toContain('<table');
    expect(html).toContain('style="');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toContain('display:flex');
    expect(html).not.toContain('display:grid');
  });

  it('escapes HTML in the report to prevent injection', () => {
    const evil = buildResultEmailHtml({
      archetypeName: 'X',
      dimensions: scores,
      markdown: 'Watch out <script>alert(1)</script> & <b>tags</b>.'
    });
    expect(evil).not.toContain('<script>alert(1)</script>');
    expect(evil).toContain('&lt;script&gt;');
    expect(evil).toContain('&amp;');
  });
});
