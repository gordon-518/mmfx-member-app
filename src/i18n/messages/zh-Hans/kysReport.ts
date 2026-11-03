import type { Messages } from "../types";

// The written Know Your Style report's six headings and its compliance footer,
// in the language the report is written in. The model is told to use these
// exact strings and the report is validated against them
// (src/lib/kys/prompt.ts, src/lib/kys/validation.ts). The English footer is
// the reviewed wording: a report in another language carries it as well.
export const kysReport: Messages["kysReport"] = {
  read: "解读",
  wellDone: "你做得好的地方",
  leak: "让你亏钱的短板",
  onGold: "它在 XAU/USD 上的表现",
  fix: "本周的改进",
  finalNote: "最后的话",
  footer: "外汇和差价合约交易涉及重大亏损风险，并不适合所有投资者。本测评仅供教育用途，不构成财务建议。",
};
