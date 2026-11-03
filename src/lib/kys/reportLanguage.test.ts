import { describe, it, expect } from 'vitest';
import { STATIC_SYSTEM_PROMPT, buildDynamicContext, reportHeadings, staticSystemPrompt } from './prompt';
import { finalizeReport, validateReport } from './validation';
import { REPORT_LANGUAGE, reportLength } from './reportLanguage';
import { getArchetype } from './archetypes';
import { scoreDimensions } from './dimensions';
import type { UserAnswers } from './types';
import { LOCALES, type Locale } from '@/i18n/config';
import { MESSAGES } from '@/i18n/messages';

const EN_FOOTER = MESSAGES.en.kysReport.footer;
const ANSWERS: UserAnswers = { q1: 'b', q3: 'f', q4: 'c', q7: 'b' };

/** A well-formed report in a language: its six headings, enough text, its footer. */
function report(locale: Locale, body: string, footer = MESSAGES[locale].kysReport.footer): string {
  return [...reportHeadings(locale).map(h => `## ${h}\n${body}`), `---\n*${footer}*`].join('\n\n');
}
const EN_BODY = 'This is body text that pads the report to a realistic length so the word count gate passes cleanly. '.repeat(6);
const ZH_BODY = '你说你通常因为想有单在手而入场，这说明你的问题不在于知识，而在于决策。'.repeat(7);
const MS_BODY = 'Ini ialah teks badan yang memanjangkan laporan supaya ujian panjang lulus dengan bersih. '.repeat(8);

describe('the report prompt', () => {
  it('is unchanged in English', () => {
    expect(staticSystemPrompt('en')).toBe(STATIC_SYSTEM_PROMPT);
    expect(staticSystemPrompt()).toBe(STATIC_SYSTEM_PROMPT);
  });

  it('asks for the report in the reader’s language, with that language’s headings and footer', () => {
    for (const locale of LOCALES.filter(l => l !== 'en')) {
      const p = staticSystemPrompt(locale);
      for (const h of reportHeadings(locale)) expect(p, `${locale}: ${h}`).toContain(`## ${h}\n`);
      for (const h of reportHeadings('en')) expect(p, `${locale} still has ${h}`).not.toContain(`## ${h}\n`);
      expect(p).toContain(`*${MESSAGES[locale].kysReport.footer}*`);
      expect(p).toContain(`Write the entire report in ${REPORT_LANGUAGE[locale].name}`);
      expect(p).toContain(REPORT_LANGUAGE[locale].lengthRule);
      expect(p).not.toContain('Plain English.');
      // The rules that keep it compliant are still there.
      expect(p).toContain('Never guarantee returns or imply profitability.');
    }
  });

  it('quotes the answers as the trader saw them and names things the app’s way', () => {
    const ctx = buildDynamicContext(getArchetype('reckless_gambler')!, ANSWERS, scoreDimensions(ANSWERS), 'zh-Hans');
    expect(ctx).toContain('- 你入场的真正理由是什么？ → 我就是想有单在手');
    expect(ctx).toContain('"鲁莽赌徒"');
    expect(ctx).toContain('Risk Discipline = 风险纪律');
    expect(ctx).toContain('the first sentence of "解读"');
    expect(ctx).toContain('Write it in Simplified Chinese');
  });

  it('keeps the English context free of any language instructions', () => {
    const ctx = buildDynamicContext(getArchetype('reckless_gambler')!, ANSWERS, scoreDimensions(ANSWERS));
    expect(ctx).toContain("- When you enter a trade, what's the actual reason? → I just want to be in a trade");
    expect(ctx).not.toContain('Write it in');
    expect(ctx.endsWith('following the structure and rules above exactly.')).toBe(true);
  });
});

describe('validateReport by language', () => {
  it('still validates an English report exactly as before', () => {
    expect(validateReport(report('en', EN_BODY)).ok).toBe(true);
    expect(validateReport(report('en', EN_BODY, 'Some other footer.')).ok).toBe(false);
  });

  it('accepts a Chinese report, counting characters rather than words', () => {
    const zh = report('zh-Hans', ZH_BODY);
    expect(zh.split(/\s+/).filter(Boolean).length).toBeLessThan(500); // a word count would reject it
    expect(validateReport(zh, 'zh-Hans')).toEqual({ ok: true });
  });

  it('rejects a report in the wrong language or with a heading missing', () => {
    expect(validateReport(report('en', EN_BODY), 'zh-Hans').ok).toBe(false);
    const missing = report('zh-Hans', ZH_BODY).replace('## 让你亏钱的短板', '## 别的标题');
    expect(validateReport(missing, 'zh-Hans').ok).toBe(false);
  });

  it('accepts the footer with its punctuation changed, but not without it', () => {
    const loose = report('zh-Hans', ZH_BODY, MESSAGES['zh-Hans'].kysReport.footer.replace(/。/g, '.'));
    expect(validateReport(loose, 'zh-Hans').ok).toBe(true);
    const none = report('zh-Hans', ZH_BODY).replace(MESSAGES['zh-Hans'].kysReport.footer, '');
    expect(validateReport(none, 'zh-Hans').ok).toBe(false);
  });

  it('applies each language’s length bounds', () => {
    expect(validateReport(report('ms', MS_BODY), 'ms').ok).toBe(true);
    expect(validateReport(report('ms', 'Terlalu pendek.'), 'ms').ok).toBe(false);
    expect(reportLength('黄金 XAU/USD 今天', 'chars')).toBe(5);
  });
});

describe('finalizeReport', () => {
  it('leaves an English report exactly as written', () => {
    const en = report('en', EN_BODY);
    expect(finalizeReport(en)).toBe(en);
  });

  it('ends every other report with its footer and the English footer, verbatim', () => {
    const zhFooter = MESSAGES['zh-Hans'].kysReport.footer;
    const written = report('zh-Hans', ZH_BODY, zhFooter.replace(/。/g, '.'));
    const out = finalizeReport(written, 'zh-Hans');
    expect(out.endsWith(`---\n*${zhFooter}*\n\n*${EN_FOOTER}*`)).toBe(true);
    expect(out.split(zhFooter.slice(0, 10)).length - 1).toBe(1); // the model's copy is replaced, not kept
    expect(out).toContain('## 最后的话');
  });

  it('replaces a footer the model wrote without a rule above it', () => {
    const zhFooter = MESSAGES['zh-Hans'].kysReport.footer;
    const written = report('zh-Hans', ZH_BODY).replace(`---\n*${zhFooter}*`, zhFooter);
    const out = finalizeReport(written, 'zh-Hans');
    expect(out.endsWith(`---\n*${zhFooter}*\n\n*${EN_FOOTER}*`)).toBe(true);
    expect(out.split(zhFooter).length - 1).toBe(1);
  });
});
