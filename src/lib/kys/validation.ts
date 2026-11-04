import type { Locale } from '@/i18n/config';
import { MESSAGES } from '@/i18n/messages';
import { reportHeadings } from './prompt';
import { REPORT_LANGUAGE, reportLength } from './reportLanguage';

const COMPLIANCE_FOOTER = MESSAGES.en.kysReport.footer;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * The footer as the model may have punctuated it. A report in Chinese can end
 * the footer with "." instead of "。", or drop the asterisks; it is still the
 * footer, and finalizeReport puts the exact wording back.
 */
function looseForm(s: string): string {
  return s.normalize('NFKC').replace(/[\s*_\p{P}]/gu, '').toLowerCase();
}

export function validateReport(
  text: string,
  locale: Locale = 'en'
): { ok: true } | { ok: false; reason: string } {
  for (const h of reportHeadings(locale)) {
    const header = new RegExp(`^## ${escapeRegExp(h)}`, 'm');
    if (!header.test(text)) return { ok: false, reason: `Missing required header matching ${header}` };
  }

  // English keeps its original rule: the reviewed footer, verbatim.
  const footerPresent =
    locale === 'en'
      ? text.includes(COMPLIANCE_FOOTER)
      : looseForm(text).includes(looseForm(MESSAGES[locale].kysReport.footer));
  if (!footerPresent) {
    return { ok: false, reason: 'Missing compliance footer' };
  }

  const lang = REPORT_LANGUAGE[locale];
  const length = reportLength(text, lang.unit);
  if (length < lang.min || length > lang.max) {
    return { ok: false, reason: `Length ${length} ${lang.unit} outside ${lang.min}-${lang.max} range` };
  }
  return { ok: true };
}

const RULE = /^\s*(?:-{3,}|\*{3,})\s*$/;

/**
 * A validated report, with its footer made exact. English is returned as it
 * is. In another language, whatever footer the model wrote is replaced by the
 * translated footer followed by the English one: the English is the reviewed
 * wording, so every report carries it, as the risk notice on /upgrade does.
 */
export function finalizeReport(text: string, locale: Locale = 'en'): string {
  if (locale === 'en') return text;
  const footer = `---\n*${MESSAGES[locale].kysReport.footer}*\n\n*${COMPLIANCE_FOOTER}*`;
  const target = looseForm(MESSAGES[locale].kysReport.footer);
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  // The footer block starts at the last horizontal rule, when what follows it
  // is the footer; otherwise at the line that carries the footer.
  let cut = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (RULE.test(lines[i])) {
      if (looseForm(lines.slice(i + 1).join('\n')).includes(target)) cut = i;
      break;
    }
  }
  if (cut === -1) cut = lines.findIndex(l => looseForm(l).includes(target));
  const body = (cut === -1 ? lines : lines.slice(0, cut)).join('\n').trimEnd();
  return `${body}\n\n${footer}`;
}
