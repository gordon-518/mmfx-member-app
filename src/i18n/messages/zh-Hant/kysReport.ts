import type { Messages } from "../types";

// The written Know Your Style report's six headings and its compliance footer,
// in the language the report is written in. The model is told to use these
// exact strings and the report is validated against them
// (src/lib/kys/prompt.ts, src/lib/kys/validation.ts). The English footer is
// the reviewed wording: a report in another language carries it as well.
export const kysReport: Messages["kysReport"] = {
  read: "解讀",
  wellDone: "你做得好的地方",
  leak: "讓你虧錢的短板",
  onGold: "它在 XAU/USD 上的表現",
  fix: "本週的改進",
  finalNote: "最後的話",
  footer: "外匯和差價合約交易涉及重大虧損風險，並不適合所有投資者。本測評僅供教育用途，不構成財務建議。",
};
