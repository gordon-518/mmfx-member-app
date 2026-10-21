const REQUIRED_HEADERS = [
  /^## The read/m,
  /^## What you do well/m,
  /^## The leak costing you money/m,
  /^## How it shows up on XAU\/USD/m,
  /^## Your fix this week/m,
  /^## Final note/m
];

const COMPLIANCE_FOOTER = 'Forex and CFD trading involves substantial risk of loss and is not suitable for all investors. This assessment is for educational purposes and is not financial advice.';

export function validateReport(text: string): { ok: true } | { ok: false; reason: string } {
  for (const header of REQUIRED_HEADERS) {
    if (!header.test(text)) return { ok: false, reason: `Missing required header matching ${header}` };
  }
  if (!text.includes(COMPLIANCE_FOOTER)) {
    return { ok: false, reason: 'Missing compliance footer' };
  }
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 500 || wordCount > 1100) {
    return { ok: false, reason: `Word count ${wordCount} outside 500-1100 range` };
  }
  return { ok: true };
}
