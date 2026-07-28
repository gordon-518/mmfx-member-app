export interface AnalysisBodies { daily: string; macro: string; }

// The MM Analyst MMFX_Telegram_<date>.txt has two posts, each = a ===== header
// block (title + Image/PDF/Format meta) followed by the body. Split on the ==
// rules: header segments contain "TELEGRAM POST N — <LABEL>", and the body is
// the segment immediately after. The channel gets an app link instead of the
// PDF, so the daily's "Full breakdown / attach PDF" trailer is stripped.
export function parseTelegramTxt(txt: string): AnalysisBodies {
  const segs = txt.split(/^={3,}\s*$/m).map((s) => s.trim());
  const out: AnalysisBodies = { daily: "", macro: "" };

  for (let i = 0; i < segs.length - 1; i++) {
    const header = segs[i].match(/TELEGRAM POST\s+\d+\s*[—-]\s*(.+)/i);
    if (!header) continue;
    const label = header[1].toUpperCase();
    const body = cleanDaily(segs[i + 1]);
    if (label.includes("DAILY")) out.daily = body;
    else if (label.includes("FUNDAMENTAL") || label.includes("MACRO")) out.macro = body;
  }
  return out;
}

function cleanDaily(body: string): string {
  return body
    .split("\n")
    .filter((line) => !/attach pdf|full breakdown/i.test(line))
    .join("\n")
    .trim();
}
