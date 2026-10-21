import type { DimensionScores } from './types';
import { DIMENSIONS, rankDimensions } from './dimensions';

// Builds a self-contained, email-safe HTML body of a KYS result: branded header,
// the six-dimension profile as table-based bars, and the written report. Inline
// styles + table layout only — no flexbox/grid/JS — so it survives Gmail/Outlook.
// The member app emails this string as-is via SendPulse.

const byId = Object.fromEntries(DIMENSIONS.map((d) => [d.id, d]));

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Inline emphasis: **bold** then *italic*, on already-escaped text. */
function inline(s: string): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#241007;">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function bandColor(score: number): string {
  if (score <= 40) return '#D9531A';
  if (score <= 64) return '#E0892E';
  return '#4E9A5B';
}

/** Minimal markdown → email HTML for the report's known constructs. */
function reportBodyHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushPara = () => {
    if (para.length) {
      out.push(
        `<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#3a2c20;margin:0 0 12px;">${inline(
          para.join(' ')
        )}</p>`
      );
      para = [];
    }
  };
  const flushList = () => {
    if (list.length && listType) {
      const items = list
        .map(
          (li) =>
            `<li style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#3a2c20;margin:0 0 6px;">${inline(
              li
            )}</li>`
        )
        .join('');
      out.push(`<${listType} style="margin:0 0 12px;padding-left:20px;">${items}</${listType}>`);
      list = [];
      listType = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') {
      flushPara();
      flushList();
    } else if (line.startsWith('## ')) {
      flushPara();
      flushList();
      out.push(
        `<h2 style="font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;color:#241007;margin:22px 0 8px;border-top:1px solid #f0e0d2;padding-top:16px;">${inline(
          line.slice(3)
        )}</h2>`
      );
    } else if (line.startsWith('### ')) {
      flushPara();
      flushList();
      out.push(
        `<h3 style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#D9531A;margin:16px 0 6px;">${inline(
          line.slice(4)
        )}</h3>`
      );
    } else if (line === '---' || line === '***') {
      flushPara();
      flushList();
      out.push('<hr style="border:none;border-top:1px solid #eaddd0;margin:18px 0;">');
    } else if (/^[-*]\s+/.test(line)) {
      flushPara();
      if (listType === 'ol') flushList();
      listType = 'ul';
      list.push(line.replace(/^[-*]\s+/, ''));
    } else if (/^\d+\.\s+/.test(line)) {
      flushPara();
      if (listType === 'ul') flushList();
      listType = 'ol';
      list.push(line.replace(/^\d+\.\s+/, ''));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return out.join('\n');
}

function dimensionBlocksHtml(scores: DimensionScores): string {
  return rankDimensions(scores)
    .map(({ id, score }) => {
      const d = byId[id];
      const color = bandColor(score);
      const fill = Math.max(2, Math.min(100, score));
      return `
<div style="margin:0 0 14px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px;">
    <tr>
      <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#241007;">${esc(
        d.name
      )}</td>
      <td align="right" style="font-family:'Courier New',monospace;font-size:12px;color:#a78a76;">${score} / 100</td>
    </tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:4px;overflow:hidden;background:#eee4da;">
    <tr>
      <td width="${fill}%" style="background:${color};height:8px;line-height:8px;font-size:0;">&nbsp;</td>
      <td style="height:8px;line-height:8px;font-size:0;">&nbsp;</td>
    </tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:5px 0 0;">
    <tr>
      <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#c2543a;">${esc(d.lowPole)}</td>
      <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a857c;">${esc(
        d.highPole
      )}</td>
    </tr>
  </table>
</div>`;
    })
    .join('');
}

export function buildResultEmailHtml(input: {
  archetypeName: string;
  dimensions: DimensionScores;
  markdown: string;
}): string {
  const { archetypeName, dimensions, markdown } = input;
  return `<div style="background:#FBE7DA;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;background:#FFFDFB;border:1px solid #F0E0D2;border-radius:16px;">
    <tr>
      <td style="padding:28px 28px 4px;">
        <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#D9531A;">Know Your Style · Your Trading Style</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:30px;font-weight:bold;color:#241007;margin-top:8px;line-height:1.1;">${esc(
          archetypeName
        )}</div>
        <div style="height:3px;width:60px;background:#FF5A1F;border-radius:9px;margin-top:14px;"></div>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 28px 28px;">
        <h2 style="font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;color:#241007;margin:0 0 4px;">Your profile</h2>
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#6f5847;margin:0 0 16px;">Six dimensions of how you trade. Your weakest are where the money leaks.</p>
        ${dimensionBlocksHtml(dimensions)}
        ${reportBodyHtml(markdown)}
      </td>
    </tr>
  </table>
</div>`;
}
